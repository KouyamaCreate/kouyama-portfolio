import { createClient } from 'microcms-js-sdk';

export type worksItem = {
    id: string;
    createdAt: string;
    updatedAt: string;
    publishedAt: string;
    revisedAt: string;
    title: string;
    thumbnail: {
        url: string;
        height: number;
        width: number;
    };
    isWorks: string[]; // "is-works" のハイフンをキャメルケースに変換
    creationTime: number; // "creation-time"
    releaseDate: string; // ISO8601形式の日時
    part: string;
    about: string;
    point: string;
    movie: string; // HTML文字列
    background: string;
    concept: string;
    process: string; // HTML文字列
    note: string;
    photos: string[]; // 配列だが、要素がない
};




if (!process.env.SERVICE_ENDPOINT) {
    throw new Error("MICROCMS_SERVICE_ENDPOINT is required");
}

if (!process.env.API_KEY) {
    throw new Error("MICROCMS_SERVICE_DOMAIN is required");
}

console.log("Fetching from:", process.env.SERVICE_ENDPOINT);

export const client = createClient({
    serviceDomain: process.env.SERVICE_ENDPOINT,
    apiKey: process.env.API_KEY,
});

// ブログ一覧を取得
export const getItems = async () => {
    const blogs = await client.getList<worksItem>({
        endpoint: "works"
    });
    return blogs;
}

// ブログの詳細を取得
export const getDetail = async (contentId: string) => {
    const item = await client.getListDetail<worksItem>({
        endpoint: "works",
        contentId,
    });
    return item;
};


