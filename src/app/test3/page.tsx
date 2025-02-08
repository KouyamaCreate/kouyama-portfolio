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

// 角度の差分を -180～+180 に正規化するヘルパー関数
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
    // deviceorientation イベントハンドラーを参照するための ref
    const deviceOrientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        // シーンの作成
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // カメラの作成
        const camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);
        const radius = 4;
        // 初期位置は仮設定。後でセンサ値に基づき球面座標で更新する
        camera.position.set(0, 0, radius);

        // レンダラーの作成
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(canvasWidth, canvasHeight);
        const container = document.getElementById("three-container");
        if (container) {
            container.appendChild(renderer.domElement);
        }

        // ライティングの追加
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

        // マウスカーソルに追従する円（PC用）を作成
        const circleSize: number = 0.2;
        const circleGeometry = new THREE.CircleGeometry(circleSize / 2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
        });
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        circleMesh.renderOrder = 9999;
        scene.add(circleMesh);

        // モバイル用：センサ値から算出した角度（ラジアン）の保持変数
        // deviceRotationX：垂直方向（ピッチ）、deviceRotationY：水平方向（ヨー）
        let deviceRotationX = 0;
        let deviceRotationY = 0;

        // センサの基準値（起動時または一定時間動きがなかったときの値）
        let baseBeta: number | null = null;
        let baseGamma: number | null = null;
        let lastMovementTime = Date.now();
        const movementThreshold = 0.5; // 0.5°未満の変化なら「動いていない」とみなす
        const inactivityDuration = 3000; // 3秒

        // モバイル判定
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

        // deviceorientation イベントハンドラー
        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta === null || event.gamma === null) return;
            const now = Date.now();

            // 初回または基準未設定ならキャリブレーション
            if (baseBeta === null || baseGamma === null) {
                baseBeta = event.beta;
                baseGamma = event.gamma;
                lastMovementTime = now;
            }

            // 垂直方向（β）の差分は正規化して算出
            let rawRelativeBeta = event.beta - (baseBeta || 0);
            rawRelativeBeta = normalizeAngleDifference(rawRelativeBeta);
            // 水平方向（γ）はそのまま差分を算出（通常は -90～90 の範囲）
            let rawRelativeGamma = event.gamma - (baseGamma || 0);

            // センサ値の 1/5（倍率 0.2）を反映
            let tiltXDeg = rawRelativeBeta * 0.2;
            let tiltYDeg = rawRelativeGamma * 0.2;
            // 各軸とも ±30° にクランプ（その角度で止める）
            tiltXDeg = THREE.MathUtils.clamp(tiltXDeg, -30, 30);
            tiltYDeg = THREE.MathUtils.clamp(tiltYDeg, -30, 30);

            // ラジアンに変換して保持
            deviceRotationX = THREE.MathUtils.degToRad(tiltXDeg);
            deviceRotationY = THREE.MathUtils.degToRad(tiltYDeg);

            // 動きが閾値以上なら最終動作時刻を更新し、なければ一定時間後に再キャリブレーション
            if (Math.abs(rawRelativeBeta) > movementThreshold || Math.abs(rawRelativeGamma) > movementThreshold) {
                lastMovementTime = now;
            } else if (now - lastMovementTime > inactivityDuration) {
                baseBeta = event.beta;
                baseGamma = event.gamma;
                console.log("基準角度をリセットしました。", { baseBeta, baseGamma });
                lastMovementTime = now;
            }
        }
        deviceOrientationHandlerRef.current = handleDeviceOrientation;

        // updateScene でカメラ位置およびその他オブジェクトの更新
        const updateScene = () => {
            if (roomModel) {
                roomModel.position.set(0, 0, 0);
                roomModel.scale.set(canvasWidth / 300, canvasHeight / 300, 2.5);
            }

            if (isMobile) {
                // センサから得た deviceRotationX（ピッチ）と deviceRotationY（ヨー）をもとに
                // 球面座標を用いてカメラの位置を更新する
                // φ = π/2 - ピッチ、θ = ヨー とする
                const phi = Math.PI / 2 - deviceRotationX;
                const theta = deviceRotationY;
                const posX = radius * Math.sin(phi) * Math.cos(theta);
                const posY = radius * Math.cos(phi);
                const posZ = radius * Math.sin(phi) * Math.sin(theta);
                camera.position.set(posX, posY, posZ);
                camera.lookAt(0, 0, 0);

                // オーバーレイ用の円はカメラのワールド回転を反映
                circleMesh.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
            } else {
                // PCの場合は必要に応じたマウス操作等で更新（ここでは簡易的な例）
                // ※必要ならマウス操作の値（mouseX, mouseY）からカメラ位置を計算してください
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
                // iOS などではユーザー操作が必要なためボタン表示
                setMotionPermissionNeeded(true);
            } else {
                window.addEventListener("deviceorientation", handleDeviceOrientation);
            }
        } else {
            window.addEventListener("mousemove", (event) => {
                // PC 用のマウス操作（必要に応じて実装してください）
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

    // iOS 用：モーションアクセス許可をリクエストするハンドラー
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
