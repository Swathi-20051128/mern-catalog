import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#c2650f", "#155e5a", "#a3720d", "#1a7a45", "#7c3aed", "#0369a1", "#b5342c"];

export default function CategoryChart({ data }) {
  const top = data.slice(0, 7);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#8a8674" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fontSize: 11.5, fill: "#12151b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(18,21,27,0.04)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e6e3da" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
          {top.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
