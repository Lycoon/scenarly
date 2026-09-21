import { redirect } from "next/navigation";

/** `/community` has no page of its own: Coverage is the front door. */
export default function CommunityPage() {
    redirect("/community/coverage");
}
