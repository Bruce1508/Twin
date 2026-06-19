import { db } from "@/lib/db";
import { getTaxonomyEntry } from "@/lib/taxonomy";

// SM-2 quality map
const QUALITY: Record<string, number> = { again: 0, hard: 3, good: 4, easy: 5 };

function sm2Update(
  card: { interval: number; easeFactor: number; reviewCount: number },
  quality: number
) {
  let { interval, easeFactor, reviewCount } = card;

  if (quality >= 3) {
    if (reviewCount === 0) interval = 1;
    else if (reviewCount === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    reviewCount += 1;
  } else {
    interval = 1;
    reviewCount = 0;
  }

  const dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
  return { interval, easeFactor, reviewCount, dueAt, lastReviewedAt: new Date() };
}

// GET — lazy sync then return due cards
export async function GET() {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  try {
    // Lazy sync: find ErrorEvents without a Flashcard yet
    const allEvents = await db.errorEvent.findMany({
      where: { submission: { userId } },
      select: { id: true },
    });

    const existingCards = await db.flashcard.findMany({
      where: { userId },
      select: { errorEventId: true },
    });

    const existingIds = new Set(existingCards.map((c) => c.errorEventId));
    const newIds = allEvents.map((e) => e.id).filter((id) => !existingIds.has(id));

    if (newIds.length > 0) {
      await db.flashcard.createMany({
        data: newIds.map((errorEventId) => ({ userId, errorEventId })),
        skipDuplicates: true,
      });
    }

    // Fetch due cards with error event details
    const now = new Date();
    const due = await db.flashcard.findMany({
      where: { userId, dueAt: { lte: now } },
      include: { errorEvent: true },
      orderBy: { dueAt: "asc" },
    });

    const total = await db.flashcard.count({ where: { userId } });

    // Next due card if none are due now
    const nextCard = due.length === 0
      ? await db.flashcard.findFirst({
          where: { userId, dueAt: { gt: now } },
          orderBy: { dueAt: "asc" },
          select: { dueAt: true },
        })
      : null;

    const cards = due.map((c) => ({
      id: c.id,
      interval: c.interval,
      reviewCount: c.reviewCount,
      errorEvent: {
        errorTag: c.errorEvent.errorTag,
        category: c.errorEvent.category,
        excerpt: c.errorEvent.excerpt,
        correction: c.errorEvent.correction,
        explanation: c.errorEvent.explanation,
        gloss: getTaxonomyEntry(c.errorEvent.errorTag)?.gloss ?? "",
      },
    }));

    return Response.json({ due: cards, total, nextDue: nextCard?.dueAt ?? null });
  } catch (err) {
    console.error("Flashcard fetch failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}

// POST — submit review result and update SM-2 schedule
export async function POST(request: Request) {
  const userId = process.env.DEV_USER_ID;
  if (!userId) return Response.json({ error: "DEV_USER_ID not configured" }, { status: 503 });

  let body: { cardId?: string; rating?: string };
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { cardId, rating } = body;
  if (!cardId || !rating || !(rating in QUALITY)) {
    return Response.json({ error: "cardId and rating (again|hard|good|easy) required" }, { status: 400 });
  }

  try {
    const card = await db.flashcard.findUnique({ where: { id: cardId } });
    if (!card) return Response.json({ error: "Card not found" }, { status: 404 });
    if (card.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

    const updates = sm2Update(card, QUALITY[rating]);
    const updated = await db.flashcard.update({ where: { id: cardId }, data: updates });

    return Response.json({ card: updated });
  } catch (err) {
    console.error("Flashcard update failed:", err);
    return Response.json({ error: "DB error" }, { status: 503 });
  }
}
