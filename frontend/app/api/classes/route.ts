import { getCurrentUser } from "@/lib/current-user";
import { createClassroom, listUserClassrooms } from "@/lib/classroom-service";
import { normalizeClassroomName } from "@/lib/classroom";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  return Response.json({ memberships: await listUserClassrooms(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  let name: string;
  try {
    const body = await request.json();
    name = normalizeClassroomName(body.name);
  } catch {
    return Response.json({ error: "Classroom name is invalid" }, { status: 400 });
  }

  try {
    const classroom = await createClassroom(user.id, name);
    return Response.json({ classroom }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create classroom" }, { status: 500 });
  }
}
