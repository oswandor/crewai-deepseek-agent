import type { Metadata } from "next";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Investigación web | CrewAI",
  description: "Investiga temas con CrewAI, AG-UI y SearXNG.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
