import { getDetail, getItems } from "@/../libs/client";
import Image from "next/image";

// 動的なルートのパスを生成
export async function generateStaticParams() {
    const { contents } = await getItems();

    return contents.map((item) => ({
        itemId: item.id, // ここを修正（params をつけない）
    }));
}

export default async function StaticDetailPage({ params }: { params: { itemId: string } }) {
    const item = await getDetail(params.itemId);

    // YouTubeのURLから埋め込み用URLに変換
    const getYouTubeEmbedUrl = (url: string) => {
        const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
        return videoIdMatch ? `https://www.youtube.com/embed/${videoIdMatch[1]}` : null;
    };

    return (
        <>
            <div className="page">
                {/* タイトル */}
                <h1 className="title">{item.title}</h1>

                {/* サムネイル */}
                {item.thumbnail?.url && (
                    <Image
                        src={item.thumbnail.url}
                        alt={item.title}
                        width={item.thumbnail.width}
                        height={item.thumbnail.height}
                        className="thumbnail"
                        layout="intrinsic"
                    />
                )}

                {/* メタ情報 */}
                <div className="meta">
                    <p className="meta-item updated-at">更新日: {new Date(item.updatedAt).toLocaleDateString()}</p>
                    <p className="meta-item release-date">リリース日: {new Date(item.releaseDate).toLocaleDateString()}</p>
                </div>

                {/* カテゴリー（is-works） */}
                {item.isWorks && (
                    <div className="categories">
                        <h2 className="section-title">カテゴリー</h2>
                        <ul className="category-list">
                            {item.isWorks.map((tag: string, index: number) => (
                                <li key={index} className="category-item">
                                    {tag}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 各セクション */}
                <section className="section about">
                    <h2 className="section-title">概要</h2>
                    <p className="section-content">{item.about}</p>
                </section>

                <section className="section point">
                    <h2 className="section-title">注目ポイント</h2>
                    <p className="section-content">{item.point}</p>
                </section>

                <section className="section background">
                    <h2 className="section-title">背景</h2>
                    <p className="section-content">{item.background}</p>
                </section>

                <section className="section concept">
                    <h2 className="section-title">コンセプト</h2>
                    <p className="section-content">{item.concept}</p>
                </section>

                <section className="section process">
                    <h2 className="section-title">制作工程</h2>
                    <div className="section-content" dangerouslySetInnerHTML={{ __html: item.process }} />
                </section>

                {/* 動画埋め込み */}
                {item.movie && (
                    <section className="section movie">
                        <h2 className="section-title">動画</h2>
                        <div className="section-content">
                            <iframe
                                className="youtube-embed"
                                width="560"
                                height="315"
                                src={getYouTubeEmbedUrl(item.movie) as string}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    </section>
                )}

                {/* 備考 */}
                <section className="section note">
                    <h2 className="section-title">備考</h2>
                    <p className="section-content">{item.note}</p>
                </section>

                {/* 画像ギャラリー */}
                {item.photos.length > 0 && (
                    <section className="section gallery">
                        <h2 className="section-title">フォトギャラリー</h2>
                        <div className="photo-list">
                            {item.photos.map((photo: string, index: number) => (
                                <Image
                                    key={index}
                                    src={photo}
                                    alt={`Photo ${index + 1}`}
                                    width={300} // 適切なサイズを設定
                                    height={200} // 適切なサイズを設定
                                    className="photo-item"
                                />
                            ))}

                        </div>
                    </section>
                )}
            </div>
        </>
    )
}