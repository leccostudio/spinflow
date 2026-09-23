import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackLink() {
  return (
    <Link
      to="/configuracoes"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 12 }}
    >
      <ArrowLeft size={14} /> Configurações
    </Link>
  );
}
