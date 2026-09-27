import ManifestoContent from "@components/home/manifesto/ManifestoContent";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Manifesto | Scenarly®",
};

export default function ManifestoPage() {
    return <ManifestoContent />;
}
