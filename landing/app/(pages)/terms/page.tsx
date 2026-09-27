import TermsContent from "@components/home/terms/TermsContent";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | Scenarly®",
};

export default function TermsPage() {
    return <TermsContent />;
}
