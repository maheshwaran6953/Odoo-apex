import { db } from "@/lib/db";
import { currentRole } from "@/server/auth";
import { moveTask, addTask } from "@/server/actions/fundraisers";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading, date, Empty } from "@/components/club/ui";
const columns = [
  { status: "TODO", title: "To do", note: "Ready for a helping hand" },
  { status: "DOING", title: "In progress", note: "The team is on it" },
  { status: "DONE", title: "Done", note: "One less thing to worry about" },
] as const;
export default async function FundraisersPage() {
  const [tasks, members, role] = await Promise.all([
    db.task.findMany({
      include: { assignee: true },
      orderBy: { title: "asc" },
    }),
    db.member.findMany({ orderBy: { name: "asc" } }),
    currentRole(),
  ]);
  return (
    <main>
      <PageHeading
        eyebrow="SMALL JOBS. SHARED EFFORT."
        title="Volunteer board"
        description="Keep fundraisers moving without losing the details in a group chat."
      />
      {role === "STAFF" && (
        <details className="disclosure">
          <summary>+ Add a volunteer task</summary>
          <ActionForm action={addTask}>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="field">
                <span>Task title</span>
                <input
                  className="input"
                  name="title"
                  required
                  minLength={3}
                  placeholder="Set up the bake-sale table"
                />
              </label>
              <label className="field">
                <span>Assign to</span>
                <select className="input" name="assigneeId">
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due date (optional)</span>
                <input className="input" type="date" name="dueAt" />
              </label>
            </div>
            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                className="input"
                name="description"
                placeholder="Supplies, location, or anything the volunteer should know."
              />
            </label>
            <button className="button">Add task</button>
          </ActionForm>
        </details>
      )}
      {role !== "STAFF" && (
        <p className="subtext mb-5">
          You’re viewing the board. Staff can add tasks and update their
          progress.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-3">
        {columns.map((column) => {
          const list = tasks.filter((t) => t.status === column.status);
          return (
            <section key={column.status} className="kanban-column">
              <div className="flex justify-between items-center">
                <h2 className="section-title">{column.title}</h2>
                <span className={`badge ${column.status.toLowerCase()}`}>
                  {list.length}
                </span>
              </div>
              <p className="subtext mt-1 mb-5">{column.note}</p>
              {list.map((task) => (
                <article key={task.id} className="task-card">
                  <h3>{task.title}</h3>
                  {task.description && (
                    <p className="subtext mt-2 whitespace-pre-line">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-4">
                    <span className="avatar small">
                      {task.assignee?.name.charAt(0) ?? "?"}
                    </span>
                    <span className="subtext">
                      {task.assignee?.name ?? "Needs a volunteer"}
                    </span>
                  </div>
                  {task.dueAt && (
                    <p
                      className={`subtext mt-3 ${task.dueAt < new Date() && task.status !== "DONE" ? "!text-[#9b5f46]" : ""}`}
                    >
                      Due {date(task.dueAt)}
                      {task.dueAt < new Date() && task.status !== "DONE"
                        ? " · Overdue"
                        : ""}
                    </p>
                  )}
                  {role === "STAFF" && (
                    <ActionForm action={moveTask}>
                      <input name="taskId" value={task.id} type="hidden" />
                      <div className="task-actions">
                        <select
                          className="input !text-xs"
                          name="status"
                          defaultValue={task.status}
                          aria-label={`Status for ${task.title}`}
                        >
                          {columns.map((c) => (
                            <option key={c.status} value={c.status}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <button className="button secondary small">
                          Update status
                        </button>
                      </div>
                    </ActionForm>
                  )}
                </article>
              ))}
              {!list.length && <Empty>No tasks in this column.</Empty>}
            </section>
          );
        })}
      </div>
    </main>
  );
}
