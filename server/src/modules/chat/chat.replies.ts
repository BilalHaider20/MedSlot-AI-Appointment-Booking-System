// Everything the assistant says. Short, plain, second person, no exclamation marks
// (see docs/DESIGN.md "Writing"). The model never writes these.
import { DateTime } from 'luxon';
import { dayLabel, localDate, localTime } from '../../lib/time.js';
import type { Appointment } from '../appointments/appointments.service.js';
import type { Service } from '../services/services.service.js';
import type { Decision } from './chat.flow.js';
import type { ChatState, Draft, Ui } from './chat.types.js';

export type ReplyText = { content: string; ui?: Ui };

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${lowerFirst(name)}`;
const formatPrice = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const weekdayPlural = (date: string) => `${DateTime.fromISO(date).toFormat('cccc')}s`;

function listWithOr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
}

const serviceChips = (services: Service[]): Ui => ({
  type: 'services',
  services: services.map(({ id, name }) => ({ id, name })),
});

const slotChips = (service: Service, date: string, slots: string[]): Ui => ({
  type: 'slots',
  date,
  serviceId: service.id,
  slots,
});

export function greeting(businessName: string, services: Service[]): ReplyText {
  return {
    content: `Hi, I'm the booking assistant for ${businessName}. What would you like to book?`,
    ui: serviceChips(services),
  };
}

export function forDecision(decision: Decision): ReplyText {
  switch (decision.kind) {
    case 'askService':
      return {
        content: decision.ambiguous
          ? `Which one would you like: ${listWithOr(decision.options.map((s) => lowerFirst(s.name)))}?`
          : 'Which service would you like to book?',
        ui: serviceChips(decision.options),
      };

    case 'askDate':
      return { content: `What day works for your ${lowerFirst(decision.service.name)}?` };

    case 'moveDay': {
      const why = {
        past: 'That date has already passed.',
        closed: `We're closed on ${weekdayPlural(decision.requested)}.`,
        full: `Nothing is free on ${dayLabel(decision.requested)}.`,
      }[decision.reason];
      if (!decision.next) {
        return { content: `${why} I can't see a free time in the next two weeks. Try a later date.` };
      }
      return {
        content: `${why} The next free day is ${dayLabel(decision.next.date)}. These times are free:`,
        ui: slotChips(decision.service, decision.next.date, decision.next.slots),
      };
    }

    case 'pickTime': {
      const day = dayLabel(decision.day.date);
      let content = `These times are free on ${day}:`;
      if (decision.preferenceMissed) content = `Nothing is free in the ${decision.timeOfDay} on ${day}. These times are:`;
      else if (decision.timeOfDay) content = `These ${decision.timeOfDay} times are free on ${day}:`;
      return { content, ui: slotChips(decision.service, decision.day.date, decision.shown) };
    }

    case 'timeUnavailable': {
      const day = dayLabel(decision.day.date);
      const { openTime, closeTime } = decision.hours;
      const content =
        decision.reason === 'taken'
          ? `${decision.time} is taken on ${day}. These are free:`
          : `${decision.time} doesn't fit in our hours (${openTime} to ${closeTime}). These are free on ${day}:`;
      return { content, ui: slotChips(decision.service, decision.day.date, decision.day.slots) };
    }

    case 'confirm': {
      const { draft, service } = decision;
      return {
        content:
          `${service.name} on ${dayLabel(draft.date)} at ${draft.time}, ` +
          `${service.durationMinutes} minutes, ${formatPrice(service.priceCents)}. Should I book it?`,
        ui: { type: 'confirm', draft },
      };
    }
  }
}

export function booked(draft: Draft, appointmentId: string): ReplyText {
  return {
    content: `You're booked for ${withArticle(draft.serviceName)} on ${dayLabel(draft.date)} at ${draft.time}.`,
    ui: { type: 'booked', appointmentId },
  };
}

export function justTaken(time: string, service: Service, date: string, slots: string[]): ReplyText {
  if (slots.length === 0) {
    return { content: `Sorry, ${time} was just taken and nothing else is free on ${dayLabel(date)}. What other day works?` };
  }
  return {
    content: `Sorry, ${time} was just taken. These are still free on ${dayLabel(date)}:`,
    ui: slotChips(service, date, slots),
  };
}

export function offerForm(state: ChatState, reason: 'unclear'): ReplyText {
  return {
    content: "I'm not quite following. You can fill in the details here instead.",
    ui: { type: 'form', draft: state.draft, reason },
  };
}

export function dropped(services: Service[]): ReplyText {
  return {
    content: "Okay, I haven't booked it. If you'd like a different service or time, tell me or pick one here.",
    ui: serviceChips(services),
  };
}

export function upcoming(appointments: Appointment[], timezone: string): ReplyText {
  if (appointments.length === 0) return { content: 'You have no upcoming appointments.' };

  const items = appointments.map((appointment) => {
    const startsAt = new Date(appointment.startsAt);
    return `${lowerFirst(appointment.service.name)} on ${dayLabel(localDate(startsAt, timezone))} at ${localTime(startsAt, timezone)}`;
  });
  if (items.length === 1) return { content: `You have one upcoming appointment: ${items[0]}.` };
  const list = `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
  return { content: `You have ${items.length} upcoming appointments: ${list}.` };
}

export function cancelHint(): ReplyText {
  return {
    content:
      "To cancel, use the Cancel button on the booking under Your appointments. I don't cancel from chat, so nothing gets cancelled by mistake.",
  };
}

export function smalltalk(services: Service[]): ReplyText {
  return {
    content: "I can book an appointment, check what's free, or list your bookings. What would you like to do?",
    ui: serviceChips(services),
  };
}
