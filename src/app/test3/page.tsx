"use client";
import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// DeviceOrientationEvent に requestPermission を含む型定義
interface DeviceOrientationEventConstructorWithPermission {
    new(type: string, eventInitDict?: DeviceOrientationEventInit): DeviceOrientationEvent;
    prototype: DeviceOrientationEvent;
    requestPermission?: () => Promise<string>;
}

// 角度の差分を -180～+180 に正規化するヘルパー関数（β用）
function normalizeAngleDifference(angle: number): number {
    let diff = angle % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
}

export default function Page() {
    // モーションパーミッションの状態管理
    const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
    const [motionPermissionGranted, setMotionPermissionGranted] = useState(false);
    // deviceorientation 用ハンドラーを外部から参照できるようにする ref
    const deviceOrientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        // シーン作成
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // カメラ作成
        const camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);
        camera.position.set(0, 0, 4);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        let mouseX: number = canvasWidth / 2;
        let mouseY: number = canvasHeight / 2;
        const circleSize: number = 0.2;

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        // レンダラー作成
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(canvasWidth, canvasHeight);
        const container = document.getElementById("three-container");
        if (container) {
            container.appendChild(renderer.domElement);
        }

        // ライティング追加
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(100, 100, 100);
        scene.add(directionalLight);

        // glTF モデルの読み込み
        let roomModel: THREE.Object3D | null = null;
        const loader = new GLTFLoader();
        loader.load(
            "/models/room.glb",
            (gltf) => {
                roomModel = gltf.scene;
                const targetMaterialName = "display"; // 変更したいマテリアル名

                roomModel.traverse((object) => {
                    if ((object as THREE.Mesh).isMesh) {
                        const mesh = object as THREE.Mesh;
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach((material) => {
                                if (material.name === targetMaterialName) {
                                    const video = document.createElement("video");
                                    video.muted = true;
                                    video.autoplay = true;
                                    video.setAttribute("playsinline", "");
                                    video.src = "/textures/test.webm";
                                    video.loop = true;
                                    video.load();
                                    video.play();
                                    const texture = new THREE.VideoTexture(video);
                                    texture.magFilter = THREE.LinearFilter;
                                    texture.minFilter = THREE.LinearFilter;
                                    texture.format = THREE.RGBFormat;
                                    (material as THREE.MeshStandardMaterial).map = texture;
                                }
                            });
                        } else {
                            if (mesh.material.name === targetMaterialName) {
                                const video = document.createElement("video");
                                video.muted = true;
                                video.autoplay = true;
                                video.setAttribute("playsinline", "");
                                video.src = "/textures/test.webm";
                                video.loop = true;
                                video.load();
                                const texture = new THREE.VideoTexture(video);
                                texture.magFilter = THREE.LinearFilter;
                                texture.minFilter = THREE.LinearFilter;
                                texture.format = THREE.RGBFormat;
                                (mesh.material as THREE.MeshStandardMaterial).map = texture;
                                video.play();
                            }
                        }
                    }
                });
                roomModel.position.set(0, 0, 0);
                scene.add(roomModel);
            },
            undefined,
            (error) => {
                console.error("Error loading model", error);
            }
        );

        // マウスカーソルに追従する円作成
        const circleGeometry = new THREE.CircleGeometry(circleSize / 2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
        });
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        circleMesh.renderOrder = 9999;
        scene.add(circleMesh);

        // PC用：マウス操作での回転補間変数
        let targetAngleX = 0;
        let targetAngleY = 0;

        // モバイル用：デバイスの向きを保持する変数（ラジアン）
        let deviceRotationX = 0;
        let deviceRotationY = 0;

        // ジャイロの基準角度（起動時または一定時間動きがなかったときの値）を保持
        let baseBeta: number | null = null;
        let baseGamma: number | null = null;
        /*
        // 最後に十分な動きがあった時刻（初期は現在時刻）
        let lastMovementTime = Date.now();
        // 動きがないと判断する閾値（度単位）
        const movementThreshold = 0.5; // β, γともに 0.5°未満なら「動いていない」とみなす
        // 一定期間動きがなければ再キャリブレーション（ミリ秒）
        const inactivityDuration = 3000; // 3秒*/

        // 部屋のサイズ倍率（PC, SP で異なる）
        const roomRatioPC = canvasHeight / 300 * 0.6;
        const roomRatioSP = canvasWidth / 300 * 0.9;

        // モバイル判定
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

        // deviceorientation イベントハンドラー
        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta === null || event.gamma === null) return;

            // 初回キャリブレーション時：両軸の初期値を保存する
            if (baseBeta === null) {
                baseBeta = event.beta;
            }
            if (baseGamma === null) {
                baseGamma = event.gamma;
            }

            // 現在の角度と基準との差分（度）を算出
            let rawRelativeBeta = event.beta - baseBeta;
            rawRelativeBeta = normalizeAngleDifference(rawRelativeBeta);

            // ※ γ は -90～+90 の範囲内で得られるので、そのままでよい
            let rawRelativeGamma = event.gamma - baseGamma;
            rawRelativeGamma = THREE.MathUtils.clamp(rawRelativeGamma, -90, 90);

            // 反映倍率 0.2（両軸とも）で調整
            let tiltXDeg = rawRelativeBeta * 0.2;
            let tiltYDeg = rawRelativeGamma * 0.2;

            // 両軸とも ±30° にクランプ
            tiltXDeg = THREE.MathUtils.clamp(tiltXDeg, -30, 30);
            tiltYDeg = THREE.MathUtils.clamp(tiltYDeg, -30, 30);

            // 縦方向はそのままラジアン変換  
            deviceRotationX = THREE.MathUtils.degToRad(tiltXDeg);
            // 横方向は符号反転して変換（※ここが修正ポイント）
            deviceRotationY = THREE.MathUtils.degToRad(-tiltYDeg);

            /*// 動きが閾値以上なら最終動作時刻更新（β も含む）
            if (Math.abs(rawRelativeBeta) > movementThreshold || Math.abs(rawRelativeGamma) > movementThreshold) {
                lastMovementTime = now;
            } else {
                // 一定期間動きがなければ縦方向（β）のみ基準角度をリセットする  
                // ※ 横方向（γ）は固定することで、急激な反転を防ぎます。
                if (now - lastMovementTime > inactivityDuration) {
                    baseBeta = event.beta;
                    // baseGamma の再キャリブレーションは行わない
                    console.log("基準角度をリセットしました。", { baseBeta, baseGamma });
                    lastMovementTime = now;
                }
            }*/
        }
        // ハンドラーを ref に保存
        deviceOrientationHandlerRef.current = handleDeviceOrientation;

        const updateScene = () => {
            if (roomModel) {
                roomModel.position.set(0, 0, 0);
                // PCの場合：マウス座標から移動量を計算
                const moveX = (mouseX - canvasWidth / 2) / 10;
                const moveY = (canvasHeight / 2 - mouseY) / 10;
                targetAngleX = moveY / 100;
                targetAngleY = moveX / 100;
                if (isMobile) {
                    roomModel.scale.set(roomRatioSP, roomRatioSP, roomRatioSP);
                }
                else {
                    roomModel.scale.set(roomRatioPC, roomRatioPC, roomRatioPC);
                }
            }

            const radius = 4;
            if (isMobile) {
                // ─────────────────────────────
                // モバイルの場合：Euler を用いて回転計算
                // deviceRotationX（ピッチ）は ±30°にクランプ済み
                const euler = new THREE.Euler(deviceRotationX, deviceRotationY, 0, "YXZ");
                const quaternion = new THREE.Quaternion().setFromEuler(euler);

                // カメラ位置は Z 軸方向に一定距離（radius）離した位置にオフセット
                const offset = new THREE.Vector3(0, 0, radius);
                offset.applyQuaternion(quaternion);
                camera.position.copy(offset);
                camera.lookAt(0, 0, 0);

                // オーバーレイの円にも同じ回転を適用
                //circleMesh.quaternion.copy(quaternion);
            } else {

                // PCの場合：従来通りマウス座標から計算
                const rotationX = -1 * (mouseY - canvasHeight / 2) * 0.00012;
                const rotationY = (mouseX - canvasWidth / 2) * 0.00003;
                camera.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
                camera.position.y = radius * Math.sin(rotationX);
                camera.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
                camera.lookAt(0, 0, 0);
                // 円の位置更新
                raycaster.setFromCamera(pointer, camera);
                const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                const intersection = new THREE.Vector3();
                raycaster.ray.intersectPlane(planeZ, intersection);
                circleMesh.position.copy(intersection);

                const roomSizePC = canvasHeight * 0.65;

                const roomLU = { x: canvasWidth / 2 - roomSizePC / 2, y: canvasHeight / 2 - roomSizePC / 2 };
                const roomRU = { x: canvasWidth / 2 + roomSizePC / 2, y: canvasHeight / 2 - roomSizePC / 2 };
                const roomLD = { x: canvasWidth / 2 - roomSizePC / 2, y: canvasHeight / 2 + roomSizePC / 2 };
                const roomRD = { x: canvasWidth / 2 + roomSizePC / 2, y: canvasHeight / 2 + roomSizePC / 2 };

                const backWallLU = { x: canvasWidth / 2 - roomSizePC / 4, y: canvasHeight / 2 - roomSizePC / 4 }
                const backWallRD = { x: canvasWidth / 2 + roomSizePC / 4, y: canvasHeight / 2 + roomSizePC / 4 }

                const center = { x: canvasWidth / 2, y: canvasHeight / 2 };

                // 傾きの計算（領域に応じて角度設定）
                // 中央の「その他」領域
                if (mouseX > backWallLU.x && mouseX < backWallRD.x && mouseY > backWallLU.y && mouseY < backWallRD.y) {
                    targetAngleX = 0; // 中央
                    targetAngleY = 0;
                }

                // 上の三角形
                else if (isPointInTriangle(mouseX, mouseY, roomLU.x, roomLU.y, roomRU.x, roomRU.y, center.x, center.y)) {
                    targetAngleX = -Math.PI / 4; // 上
                    targetAngleY = 0;
                }
                // 下の三角形
                else if (isPointInTriangle(mouseX, mouseY, roomLD.x, roomLD.y, roomRD.x, roomRD.y, center.x, center.y)) {
                    targetAngleX = Math.PI / 4; // 下
                    targetAngleY = 0;
                }

                // 左の三角形
                else if (isPointInTriangle(mouseX, mouseY, roomLU.x, roomLU.y, roomLD.x, roomLD.y, center.x, center.y)) {
                    targetAngleX = 0;
                    targetAngleY = -Math.PI / 4; // 左
                }

                // 右の三角形
                else if (isPointInTriangle(mouseX, mouseY, roomRU.x, roomRU.y, roomRD.x, roomRD.y, center.x, center.y)
                ) {
                    targetAngleX = 0;
                    targetAngleY = Math.PI / 4; // 右
                }

                else {
                    targetAngleX = 0; // 中央
                    targetAngleY = 0;
                }

                // 円の傾きを適用
                circleMesh.rotation.x = targetAngleX;
                circleMesh.rotation.y = targetAngleY;
            }
        };

        const animate = () => {
            requestAnimationFrame(animate);
            updateScene();
            renderer.render(scene, camera);
        };
        animate();

        // イベントリスナーの登録
        if (isMobile) {
            const DeviceOrientationEventWithPermission = DeviceOrientationEvent as DeviceOrientationEventConstructorWithPermission;
            if (typeof DeviceOrientationEventWithPermission.requestPermission === "function") {
                // ユーザー操作が必要なためボタン表示
                setMotionPermissionNeeded(true);
            } else {
                window.addEventListener("deviceorientation", handleDeviceOrientation);
            }
        } else {
            window.addEventListener("mousemove", (event) => {
                mouseX = event.clientX;
                mouseY = event.clientY;
                pointer.x = (mouseX / canvasWidth) * 2 - 1;
                pointer.y = -(mouseY / canvasHeight) * 2 + 1;
            });
        }

        window.addEventListener("resize", () => {
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            renderer.setSize(canvasWidth, canvasHeight);
            camera.aspect = canvasWidth / canvasHeight;
            camera.updateProjectionMatrix();
        });

        return () => {
            window.removeEventListener("mousemove", () => { });
            window.removeEventListener("resize", () => { });
            if (deviceOrientationHandlerRef.current) {
                window.removeEventListener("deviceorientation", deviceOrientationHandlerRef.current);
            }
        };
    }, []);

    // iOS用：モーションアクセス許可リクエストハンドラー
    const requestMotionPermission = () => {
        const DeviceOrientationEventWithPermission = DeviceOrientationEvent as DeviceOrientationEventConstructorWithPermission;
        if (typeof DeviceOrientationEventWithPermission.requestPermission === "function") {
            DeviceOrientationEventWithPermission.requestPermission()
                .then((response: string) => {
                    if (response === "granted") {
                        setMotionPermissionGranted(true);
                        if (deviceOrientationHandlerRef.current) {
                            window.addEventListener("deviceorientation", deviceOrientationHandlerRef.current);
                        }
                    } else {
                        console.warn("Motion permission not granted");
                    }
                })
                .catch((error: unknown) => {
                    console.error("Motion permission error:", error);
                });
        }
    };

    return (
        <>
            <div
                id="three-container"
                style={{
                    width: "100vw",
                    height: "100vh",
                    position: "fixed",
                    top: 0,
                    left: 0,
                    cursor: "none", // カーソル非表示
                }}
            />
            {motionPermissionNeeded && !motionPermissionGranted && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10000,
                    }}
                >
                    <button
                        onClick={requestMotionPermission}
                        style={{
                            padding: "1rem 2rem",
                            fontSize: "1.2rem",
                            cursor: "pointer",
                        }}
                    >
                        モーションアクセスを許可する
                    </button>
                </div>
            )}
        </>
    );
}

// 2Dベクトルの三角形内判定
function isPointInTriangle(px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
    cx: number, cy: number): boolean {
    // 三角形の面積を求めるヘルパー関数
    function area(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number {
        return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
    }

    // 三角形ABCの面積
    const areaABC = area(ax, ay, bx, by, cx, cy);

    // 部分三角形ABP, BCP, CAPの面積
    const areaABP = area(ax, ay, bx, by, px, py);
    const areaBCP = area(bx, by, cx, cy, px, py);
    const areaCAP = area(cx, cy, ax, ay, px, py);

    // 合計が元の三角形の面積と等しければ内包される
    return Math.abs(areaABC - (areaABP + areaBCP + areaCAP)) < 1e-10;
}