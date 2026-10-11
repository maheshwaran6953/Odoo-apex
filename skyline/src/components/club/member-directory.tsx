"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  activateMembership,
  setMembershipDues,
} from "@/server/actions/members";
import { ActionForm } from "./action-form";
import { date, money, Empty } from "./ui";
type Member = {
  id: string;
  name: string;
  email: string;
  membership: {
    status: string;
    duesCents: number;
    expiresAt: string;
  } | null;
};
export function MemberDirectory({
  members,
  canManage,
}: {
  members: Member[];
  canManage: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const status = (member: Member) =>
    member.membership?.status === "ACTIVE" &&
    new Date(member.membership.expiresAt) < new Date()
      ? "EXPIRED"
      : (member.membership?.status ?? "PENDING");
  const visible = members.filter(
    (m) =>
      (m.name + " " + m.email).toLowerCase().includes(search.toLowerCase()) &&
      (filter === "ALL" || status(m) === filter),
  );
  return (
    <section className="glass-panel panel">
      <div className="toolbar">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-3.5 text-muted" />
          <input
            className="input pl-9"
            aria-label="Search members"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input !w-auto"
          aria-label="Filter membership status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">All memberships</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending dues</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Membership</th>
              <th>Annual dues</th>
              <th>Valid until</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="avatar">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <strong className="block font-semibold">
                        {member.name}
                      </strong>
                      <span className="subtext">{member.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${status(member).toLowerCase()}`}>
                    {status(member) === "PENDING"
                      ? "Pending dues"
                      : status(member).charAt(0) +
                        status(member).slice(1).toLowerCase()}
                  </span>
                </td>
                <td>{money(member.membership?.duesCents ?? 0)}</td>
                <td className="whitespace-nowrap">
                  {member.membership
                    ? date(member.membership.expiresAt)
                    : "Not set"}
                </td>
                <td>
                  {canManage && (
                    <details className="mb-2">
                      <summary className="section-link">
                        {member.membership ? "Set annual dues" : "Set up dues"}
                      </summary>
                      <ActionForm
                        action={setMembershipDues.bind(null, member.id)}
                      >
                        <label className="field">
                          <span>Annual dues (USD)</span>
                          <input
                            className="input"
                            name="dues"
                            type="number"
                            min="0.01"
                            max="100000"
                            step="0.01"
                            required
                            defaultValue={
                              member.membership
                                ? (member.membership.duesCents / 100).toFixed(2)
                                : undefined
                            }
                          />
                        </label>
                        <button className="button secondary small">
                          Save dues
                        </button>
                        <p className="subtext">
                          Setting dues does not confirm payment.
                        </p>
                      </ActionForm>
                    </details>
                  )}
                  {canManage &&
                  (status(member) !== "ACTIVE" ||
                    new Date(member.membership?.expiresAt || "").getTime() <=
                      Date.now() + 30 * 86400000) &&
                  member.membership ? (
                    <ActionForm
                      action={activateMembership.bind(null, member.id)}
                    >
                      <button className="button secondary small">
                        {status(member) !== "PENDING"
                          ? "Record renewal"
                          : "Record dues"}
                      </button>
                    </ActionForm>
                  ) : (
                    <span className="subtext">
                      {status(member) === "ACTIVE"
                        ? "Up to date"
                        : "Staff action required"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && (
        <Empty>
          No members match your search. Try a different name or status.
        </Empty>
      )}
      <p className="subtext mt-4">
        Showing {visible.length} of {members.length} members
      </p>
    </section>
  );
}
