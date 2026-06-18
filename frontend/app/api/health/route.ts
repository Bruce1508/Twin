import { TAXONOMY, SPAN_TAGS, WHOLE_TEXT_TAGS } from "@/lib/taxonomy";

export async function GET() {
  return Response.json({
    status: "ok",
    taxonomy: {
      total: TAXONOMY.length,
      spanTags: SPAN_TAGS.length,
      wholeTextTags: WHOLE_TEXT_TAGS.length,
    },
  });
}
