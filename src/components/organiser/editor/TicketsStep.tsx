"use client";

import Link from "next/link";
import { Field, Input, inputClass, Select } from "@/components/ui/Field";
import { hasOptions, newQuestion, newTicket, QUESTION_KINDS, type QuestionDraft, type TicketDraft } from "@/lib/organiser/event-form";
import { usesTickets } from "@/lib/organiser/registration";
import { MoneyInput, StepIntro, Toggle, type StepProps } from "./fields";

type Props = StepProps & { chargesEnabled: boolean; organiserId: string };

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function TicketsStep({ form, update, errors, chargesEnabled, organiserId }: Props) {
  if (!usesTickets(form.registration)) {
    return (
      <div>
        <StepIntro title="Tickets & questions">
          {form.registration === "external"
            ? "Guests register on your own link, so there are no tickets or questions to set up here."
            : "This event is info only, so there are no tickets or questions to set up."}
        </StepIntro>
        <p className="rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-4 py-8 text-center text-sm text-muted">Nothing to do here. Head to the next step.</p>
      </div>
    );
  }

  const setTicket = (i: number, patch: Partial<TicketDraft>) =>
    update({ tickets: form.tickets.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const setQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    update({ questions: form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const hasPaid = form.tickets.some((t) => Number(t.price || 0) > 0);

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="tickets-h">
        <StepIntro title="Tickets">
          <span id="tickets-h">Add one ticket type, or several (e.g. Student, Alumni). Price 0 means free.</span>
        </StepIntro>

        {!chargesEnabled && (
          <p className="rounded-2xl border border-orange/25 bg-orange/10 px-4 py-3 text-sm text-orange">
            Paid tickets need a payout account.{" "}
            <Link href={`/organiser/settings/payments?org=${organiserId}`} className="font-semibold underline underline-offset-2">Set up payments</Link>
            . You can still save a paid event as a draft, but not publish it.
          </p>
        )}
        {hasPaid && chargesEnabled && <p className="text-xs text-muted">Payments go to your connected account. Stripe fees apply.</p>}
        {errors.tickets && <p role="alert" className="text-xs text-red-300">{errors.tickets}</p>}

        {form.tickets.map((t, i) => (
          <div key={t.key} className="glass space-y-3 rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xs font-medium text-muted">Ticket {i + 1}</p>
              {form.tickets.length > 1 && (
                <button type="button" className="text-xs text-red-300 hover:text-red-200" onClick={() => update({ tickets: form.tickets.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              )}
            </div>
            <Field label="Name" htmlFor={`t-name-${i}`} error={errors[`tickets.${i}.name`]}>
              <Input id={`t-name-${i}`} value={t.name} maxLength={60} aria-invalid={!!errors[`tickets.${i}.name`]} onChange={(e) => setTicket(i, { name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price" htmlFor={`t-price-${i}`} error={errors[`tickets.${i}.price`]}>
                <MoneyInput id={`t-price-${i}`} value={t.price} invalid={!!errors[`tickets.${i}.price`]} onChange={(price) => setTicket(i, { price })} />
              </Field>
              <Field label="Quantity" htmlFor={`t-qty-${i}`} error={errors[`tickets.${i}.quantity`]}>
                <Input id={`t-qty-${i}`} inputMode="numeric" value={t.quantity} placeholder="Unlimited" aria-invalid={!!errors[`tickets.${i}.quantity`]}
                  onChange={(e) => setTicket(i, { quantity: e.target.value.replace(/\D/g, "") })} />
              </Field>
            </div>
            <Field label="Sales end" htmlFor={`t-end-${i}`} hint="Optional" error={errors[`tickets.${i}.sales_end`]}>
              <Input id={`t-end-${i}`} type="datetime-local" value={t.sales_end} onChange={(e) => setTicket(i, { sales_end: e.target.value })} />
            </Field>
          </div>
        ))}
        {form.tickets.length < 10 && (
          <button type="button" onClick={() => update({ tickets: [...form.tickets, newTicket("")] })}
            className="w-full rounded-[18px] border border-dashed border-ink/15 py-3.5 text-sm font-medium text-accent transition duration-200 hover:border-accent/50 hover:bg-ink/[0.05]">
            + Add ticket type
          </button>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="questions-h">
        <StepIntro title={form.registration === "application" ? "Application questions" : "Questions for guests"}>
          <span id="questions-h">
            {form.registration === "application"
              ? "Applicants answer these and you approve each one."
              : "Optional. Ask guests anything you need to know before the event."}
          </span>
        </StepIntro>
        {errors.questions && <p role="alert" className="text-xs text-red-300">{errors.questions}</p>}

        {form.questions.map((q, i) => (
          <div key={q.key} className="glass space-y-3 rounded-[22px] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xs font-medium text-muted">Question {i + 1}</p>
              <div className="flex items-center gap-1 text-xs">
                <button type="button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} className="rounded-lg px-2 py-1 text-muted hover:text-fg disabled:opacity-30"
                  onClick={() => update({ questions: move(form.questions, i, i - 1) })}>↑</button>
                <button type="button" aria-label={`Move question ${i + 1} down`} disabled={i === form.questions.length - 1} className="rounded-lg px-2 py-1 text-muted hover:text-fg disabled:opacity-30"
                  onClick={() => update({ questions: move(form.questions, i, i + 1) })}>↓</button>
                <button type="button" className="rounded-lg px-2 py-1 text-red-300 hover:text-red-200" onClick={() => update({ questions: form.questions.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            </div>
            <Field label="Question" htmlFor={`q-label-${i}`} error={errors[`questions.${i}.label`]}>
              <Input id={`q-label-${i}`} value={q.label} maxLength={200} placeholder="e.g. Why do you want to attend?" aria-invalid={!!errors[`questions.${i}.label`]}
                onChange={(e) => setQuestion(i, { label: e.target.value })} />
            </Field>
            <Field label="Answer type" htmlFor={`q-kind-${i}`}>
              <Select id={`q-kind-${i}`} value={q.kind} onChange={(e) => setQuestion(i, { kind: e.target.value as QuestionDraft["kind"] })}>
                {QUESTION_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            </Field>
            {hasOptions(q.kind) && (
              <Field label="Options" htmlFor={`q-opts-${i}`} hint="One per line" error={errors[`questions.${i}.options`]}>
                <textarea id={`q-opts-${i}`} rows={3} aria-invalid={!!errors[`questions.${i}.options`]}
                  className={inputClass}
                  value={q.options.join("\n")} onChange={(e) => setQuestion(i, { options: e.target.value.split("\n") })} />
              </Field>
            )}
            <Toggle id={`q-req-${i}`} checked={q.required} onChange={(required) => setQuestion(i, { required })} label="Required" />
          </div>
        ))}
        {form.questions.length < 20 && (
          <button type="button" onClick={() => update({ questions: [...form.questions, newQuestion()] })}
            className="w-full rounded-[18px] border border-dashed border-ink/15 py-3.5 text-sm font-medium text-accent transition duration-200 hover:border-accent/50 hover:bg-ink/[0.05]">
            + Add question
          </button>
        )}
      </section>
    </div>
  );
}
