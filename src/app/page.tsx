import Link from "next/link";
import { getItems } from "@/../libs/client";

console.log("開始");

export default async function StaticPage() {
  const { contents } = await getItems();

  if (!contents) {
    return <h1>No Contents</h1>;
  }

  return (
    <>
      <div>
        <ul>
          {contents.map((item) => (
            <li key={item.id}>
              <Link href={`/${item.id}`}>{item.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}