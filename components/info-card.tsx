type InfoCardProps = {
  title: string;
  items: string[];
};

export function InfoCard({ title, items }: InfoCardProps) {
  return (
    <div className="info-card">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
