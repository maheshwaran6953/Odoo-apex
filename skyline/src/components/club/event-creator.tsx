import { LocalDateInput } from "./local-date-input";
import { addEvent } from "@/server/actions/events";
import { ActionForm } from "./action-form";
export function EventCreator() {
  return (
    <details className="disclosure">
      <summary>+ Put an event on the calendar</summary>
      <ActionForm action={addEvent}>
        <EventFields />
        <button className="button">Create event & open bookings</button>
      </ActionForm>
    </details>
  );
}

type EventValues = {
  name: string;
  location: string;
  startsAt: Date;
  registrationClosesAt: Date | null;
  capacity: number;
  memberPriceCents: number;
  nonMemberPriceCents: number;
  description: string;
  schedule: string;
  organizerEmail: string | null;
  currency: string;
  paymentMode: string;
};
export function EventFields({ event }: { event?: EventValues }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="field"><span>Checkout mode</span><select className="input" name="paymentMode" defaultValue={event?.paymentMode || "RAZORPAY_TEST"}><option value="RAZORPAY_TEST">Razorpay Test Mode — verified checkout</option><option value="PRACTICE">Practice — simulated registration</option></select></label>
        <label className="field"><span>Price currency</span><select className="input" name="currency" defaultValue={event?.currency || "INR"}><option value="INR">INR (₹) — Razorpay Test Mode</option><option value="USD">USD ($) — legacy practice events</option></select><span className="subtext">Test checkout requires INR and prices of ₹1 or more. Practice uses USD. Currency/mode are locked after booking history exists.</span></label>
        <label className="field">
          <span>Event name</span>
          <input
            className="input"
            name="name"
            required
            minLength={3}
            maxLength={100}
            defaultValue={event?.name}
            placeholder="Autumn Social"
          />
        </label>
        <label className="field">
          <span>Location</span>
          <input
            className="input"
            name="location"
            required
            maxLength={200}
            defaultValue={event?.location}
            placeholder="Student Union Hall"
          />
        </label>
        <label className="field">
          <span>Date and time (local)</span>
          <LocalDateInput
            name="startsAt"
            required
            iso={event?.startsAt.toISOString()}
          />
        </label>
        <label className="field">
          <span>Registration deadline (optional)</span>
          <LocalDateInput
            name="registrationClosesAt"
            iso={event?.registrationClosesAt?.toISOString()}
          />
        </label>
        <label className="field">
          <span>Seat capacity</span>
          <input
            className="input"
            name="capacity"
            type="number"
            min="1"
            max="10000"
            defaultValue={event?.capacity ?? 80}
            required
          />
        </label>
        <label className="field">
          <span>Organizer contact email (optional)</span>
          <input
            className="input"
            name="organizerEmail"
            type="email"
            maxLength={254}
            defaultValue={event?.organizerEmail ?? ""}
          />
        </label>
        <label className="field">
          <span>Member price (selected currency)</span>
          <input
            className="input"
            name="memberPrice"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            defaultValue={(event?.memberPriceCents ?? 15000) / 100}
            required
          />
        </label>
        <label className="field">
          <span>Guest price (selected currency)</span>
          <input
            className="input"
            name="guestPrice"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            defaultValue={(event?.nonMemberPriceCents ?? 20000) / 100}
            required
          />
        </label>
      </div>
      <label className="field">
        <span>About the event</span>
        <textarea
          className="input"
          name="description"
          minLength={10}
          maxLength={3000}
          required
          defaultValue={event?.description}
        />
      </label>
      <label className="field">
        <span>Schedule & accessibility notes</span>
        <textarea
          className="input"
          name="schedule"
          maxLength={3000}
          defaultValue={event?.schedule}
          placeholder="18:00 Doors open · 18:30 Welcome · 19:00 Dinner. Step-free entry from the east door."
        />
      </label>
    </>
  );
}
