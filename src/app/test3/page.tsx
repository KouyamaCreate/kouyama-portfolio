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

export default function Page() {
    // モーションパーミッションの状態管理
    const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
    const [motionPermissionGranted, setMotionPermissionGranted] = useState(false);
    // deviceorientation 用ハンドラーを外部から参照できるようにする ref
    const deviceOrientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        // シーンの作成
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // カメラの作成
        const camera = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000);
        camera.position.set(0, 0, 4);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        let mouseX: number = canvasWidth / 2;
        let mouseY: number = canvasHeight / 2;
        const circleSize: number = 0.2;

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

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
                const targetMaterialName = "display"; // 変更したいマテリアルの名前

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

        // マウスカーソルに追従する円の作成
        const circleGeometry = new THREE.CircleGeometry(circleSize / 2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
        });
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        circleMesh.renderOrder = 9999;
        scene.add(circleMesh);

        // PC用：マウス操作による回転補間用変数
        let targetAngleX = 0;
        let targetAngleY = 0;
        let currentAngleX = 0;
        let currentAngleY = 0;
        const animationSpeed = 0.3;

        // モバイル用：デバイスの向きを保持する変数
        let deviceRotationX = 0;
        let deviceRotationY = 0;

        // ジャイロの基準角度（起動時または一定時間動きがなかったときの値）を保持する変数
        let baseBeta: number | null = null;
        let baseGamma: number | null = null;
        // 最後に十分な動きがあった時刻（初期は現在時刻）
        let lastMovementTime = Date.now();
        // 動きがないと判断する閾値（度単位）
        const movementThreshold = 0.5; // β, γともに 0.5 度未満の変化なら「動いていない」とみなす
        // 一定期間動きがなかった場合の再キャリブレーション時間（ミリ秒）
        const inactivityDuration = 3000; // 3 秒

        // モバイル判定
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

        // deviceorientation イベントハンドラー
        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta === null || event.gamma === null) return;
            const now = Date.now();

            // 初回または基準未設定時はキャリブレーション
            if (baseBeta === null || baseGamma === null) {
                baseBeta = event.beta;
                baseGamma = event.gamma;
                lastMovementTime = now;
            }

            // 現在の角度と基準角度との差分（絶対値）
            const deltaBeta = Math.abs(event.beta - baseBeta);
            const deltaGamma = Math.abs(event.gamma - baseGamma);

            // 動きが閾値以上なら最終動作時刻を更新
            if (deltaBeta > movementThreshold || deltaGamma > movementThreshold) {
                lastMovementTime = now;
            } else {
                // 一定期間動きがなければ、現在の角度を新たな基準としてリセット
                if (now - lastMovementTime > inactivityDuration) {
                    baseBeta = event.beta;
                    baseGamma = event.gamma;
                    console.log("基準角度をリセットしました。", { baseBeta, baseGamma });
                    lastMovementTime = now;
                }
            }

            // 現在の値から基準角度を引いた相対角度（度）
            const relativeBeta = event.beta - (baseBeta || 0);
            const relativeGamma = event.gamma - (baseGamma || 0);

            // 実際のセンサの傾きの 1/5 だけ反映させ、かつ ±30° にクランプ
            let tiltXDeg = relativeBeta * 0.2; // 1/5 倍
            let tiltYDeg = relativeGamma * 0.2;
            tiltXDeg = THREE.MathUtils.clamp(tiltXDeg, -30, 30);
            tiltYDeg = THREE.MathUtils.clamp(tiltYDeg, -30, 30);

            // ラジアンに変換して反映
            deviceRotationX = THREE.MathUtils.degToRad(tiltXDeg);
            deviceRotationY = THREE.MathUtils.degToRad(tiltYDeg);
        }
        // ref にイベントハンドラーを保存
        deviceOrientationHandlerRef.current = handleDeviceOrientation;

        const updateScene = () => {
            if (roomModel) {
                roomModel.position.set(0, 0, 0);
                // PCの場合：マウス座標から移動量を計算
                const moveX = (mouseX - canvasWidth / 2) / 10;
                const moveY = (canvasHeight / 2 - mouseY) / 10;
                targetAngleX = moveY / 100;
                targetAngleY = moveX / 100;
                currentAngleX += (targetAngleX - currentAngleX) * animationSpeed;
                currentAngleY += (targetAngleY - currentAngleY) * animationSpeed;
                roomModel.scale.set(canvasWidth / 300, canvasHeight / 300, 2.5);
            }

            const radius = 4;
            if (isMobile) {
                // ─────────────────────────────────────────────
                // モバイルの場合：Euler を用いて回転を計算
                // 既に deviceRotationX, deviceRotationY は 1/5 倍かつ ±30° にクランプ済み
                const euler = new THREE.Euler(deviceRotationX, deviceRotationY, 0, "YXZ");
                const quaternion = new THREE.Quaternion().setFromEuler(euler);

                // カメラ位置は Z 軸方向に一定距離（radius）離した位置にオフセット
                const offset = new THREE.Vector3(0, 0, radius);
                offset.applyQuaternion(quaternion);
                camera.position.copy(offset);
                camera.lookAt(0, 0, 0);

                // オーバーレイの円にも同じ回転を適用
                circleMesh.quaternion.copy(quaternion);
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

    // iOS でモーションアクセス許可をリクエストするハンドラー
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
