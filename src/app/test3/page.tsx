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

        // 回転補間用変数
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
        // 最後に十分な動きがあった時刻を記録（初期は現在時刻）
        let lastMovementTime = Date.now();
        // 動きがないと判断する閾値（度単位）
        const movementThreshold = 0.5; // β,γそれぞれ0.5度未満の変化なら動きがないとする
        // 一定期間動きがなかった場合の再キャリブレーション時間（ミリ秒）
        const inactivityDuration = 3000; // 3秒

        // モバイル判定
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

        // deviceorientation イベントハンドラー（基準角度との差分を利用）
        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta === null || event.gamma === null) return;
            const now = Date.now();

            // 初回または基準が未設定ならキャリブレーション（基準角度を設定）
            if (baseBeta === null || baseGamma === null) {
                baseBeta = event.beta;
                baseGamma = event.gamma;
                lastMovementTime = now;
            }

            // 現在の角度と基準角度との差分（絶対値）
            const deltaBeta = Math.abs(event.beta - baseBeta);
            const deltaGamma = Math.abs(event.gamma - baseGamma);

            // 動きが閾値以上の場合、最後の動き時刻を更新
            if (deltaBeta > movementThreshold || deltaGamma > movementThreshold) {
                lastMovementTime = now;
            } else {
                // 一定期間（inactivityDuration）動きがなければ、現在の角度を新たな基準としてリセット
                if (now - lastMovementTime > inactivityDuration) {
                    baseBeta = event.beta;
                    baseGamma = event.gamma;
                    // リセット時はデバッグ用にログを出力
                    console.log("基準角度をリセットしました。", { baseBeta, baseGamma });
                    lastMovementTime = now; // リセット直後の時刻を更新
                }
            }

            // 現在の値から基準角度を差し引いた相対角度を計算
            const relativeBeta = event.beta - (baseBeta || 0);
            const relativeGamma = event.gamma - (baseGamma || 0);

            // 元のコードと同様に/2して値を調整
            deviceRotationX = THREE.MathUtils.degToRad(relativeBeta / 2);
            deviceRotationY = THREE.MathUtils.degToRad(relativeGamma / 2);

            // オーバーレイの円にも反映（任意）
            circleMesh.rotation.x = deviceRotationX;
            circleMesh.rotation.y = deviceRotationY;
        }
        // ref にイベントハンドラーを保存
        deviceOrientationHandlerRef.current = handleDeviceOrientation;

        const updateScene = () => {
            if (roomModel) {
                roomModel.position.set(0, 0, 0);
                // PCの場合はマウス座標から移動量を計算
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
                // モバイルの場合はデバイスの向きからカメラ位置を計算
                camera.position.x = radius * Math.sin(deviceRotationY) * Math.cos(deviceRotationX);
                camera.position.y = radius * Math.sin(deviceRotationX);
                camera.position.z = radius * Math.cos(deviceRotationY) * Math.cos(deviceRotationX);
            } else {
                // PCの場合はマウス座標から計算
                const rotationX = -1 * (mouseY - canvasHeight / 2) * 0.00012;
                const rotationY = (mouseX - canvasWidth / 2) * 0.00003;
                camera.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
                camera.position.y = radius * Math.sin(rotationX);
                camera.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
            }
            camera.lookAt(0, 0, 0);

            if (!isMobile) {
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
            // iOS の場合、requestPermission の存在を確認
            const DeviceOrientationEventWithPermission = DeviceOrientationEvent as DeviceOrientationEventConstructorWithPermission;
            if (typeof DeviceOrientationEventWithPermission.requestPermission === "function") {
                // ユーザー操作が必要なため、ボタン表示を促す
                setMotionPermissionNeeded(true);
            } else {
                // 許可不要な環境の場合は即登録
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
