import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = { "High (75-100%)": "#1a7a45", "Medium (50-74%)": "#a3720d", "Low (0-49%)": "#b5342c" };

export default function ConfidenceChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e6e3da" }} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11.5, color: "#12151b" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
