import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with the component
const PmarcaTasks = dynamic(() => import("@/components/PmarcaTasks"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh", background: "#0f0e09", display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", fontSize: 12, color: "#5a5440",
    }}>
      Loading...
    </div>
  ),
});

export default function Home() {
  return <PmarcaTasks />;
}
