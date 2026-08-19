export default function ConfidenceBadge({ value }) {
  let cls = "bg-low-soft text-low";
  if (value >= 75) cls = "bg-good-soft text-good";
  else if (value >= 50) cls = "bg-mid-soft text-mid";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[12px] font-semibold ${cls}`}>
      {value}%
    </span>
  );
}
