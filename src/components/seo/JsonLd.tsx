type JsonLdProps = {
  data: Record<string, unknown>;
  id?: string;
};

export function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script id={id} type="application/ld+json">
      {JSON.stringify(data)}
    </script>
  );
}
