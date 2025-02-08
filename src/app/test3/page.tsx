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
        // カメラ単体はグループ内で垂直回転のみ担当するので初期位置は (0,0,radius)
        const radius = 4;
        camera.position.set(0, 0, radius);

        // カメラの親グループを作成（水平回転用）
        const cameraGroup = new THREE.Group();
        cameraGroup.position.set(0, 0, 0);
        cameraGroup.add(camera);
        scene.add(cameraGroup);

        // PC用：マウス操作での回転補間用変数
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

        // PC用：マウス操作による回転補間用変数
        let targetAngleX = 0;
        let targetAngleY = 0;
        let currentAngleX = 0;
        let currentAngleY = 0;
        const animationSpeed = 0.3;

        // モバイル用：センサから得る角度（ラジアン）
        // deviceRotationX：ピッチ（垂直回転）、deviceRotationY：ヨー（水平回転）
        let deviceRotationX = 0;
        let deviceRotationY = 0;

        // ジャイロの基準角度（起動時または一定時間動きがなかったときの値）
        let baseBeta: number | null = null;
        let baseGamma: number | null = null;
        let lastMovementTime = Date.now();
        const movementThreshold = 0.5; // β,γともに 0.5°未満の変化なら「動いていない」とみなす
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

            // 現在の値から基準との差分（度）
            let rawRelativeBeta = event.beta - (baseBeta || 0);
            let rawRelativeGamma = event.gamma - (baseGamma || 0);
            rawRelativeBeta = normalizeAngleDifference(rawRelativeBeta);
            rawRelativeGamma = normalizeAngleDifference(rawRelativeGamma);

            // センサの傾きの1/5を反映（倍率0.2）し、各軸を ±30° にクランプ
            let tiltXDeg = rawRelativeBeta * 0.2;
            let tiltYDeg = rawRelativeGamma * 0.2;
            tiltXDeg = THREE.MathUtils.clamp(tiltXDeg, -30, 30);
            tiltYDeg = THREE.MathUtils.clamp(tiltYDeg, -30, 30);

            // ラジアンに変換して反映
            deviceRotationX = THREE.MathUtils.degToRad(tiltXDeg);
            deviceRotationY = THREE.MathUtils.degToRad(tiltYDeg);

            // 動きが閾値以上なら最終動作時刻更新、なければ一定時間後に再キャリブレーション
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

        const updateScene = () => {
            if (roomModel) {
                roomModel.position.set(0, 0, 0);
                // PCの場合：マウス操作で回転
                const moveX = (mouseX - canvasWidth / 2) / 10;
                const moveY = (canvasHeight / 2 - mouseY) / 10;
                targetAngleX = moveY / 100;
                targetAngleY = moveX / 100;
                currentAngleX += (targetAngleX - currentAngleX) * animationSpeed;
                currentAngleY += (targetAngleY - currentAngleY) * animationSpeed;
                roomModel.scale.set(canvasWidth / 300, canvasHeight / 300, 2.5);
            }

            if (isMobile) {
                // ─────────────────────────────
                // モバイルの場合：カメラは親グループ (cameraGroup) とカメラ本体に分割
                // 水平方向（ヨー）は cameraGroup の回転で制御
                cameraGroup.rotation.y = deviceRotationY;
                // 垂直方向（ピッチ）はカメラ自身の回転で制御（すでに ±30° にクランプ済み）
                camera.rotation.x = deviceRotationX;
                // カメラは常に原点を注視
                camera.lookAt(cameraGroup.position);
                // オーバーレイ用の円もカメラのワールド回転を反映
                circleMesh.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
            } else {
                // PCの場合：従来通りマウス操作
                const rotationX = -1 * (mouseY - canvasHeight / 2) * 0.00012;
                const rotationY = (mouseX - canvasWidth / 2) * 0.00003;
                const pos = new THREE.Vector3();
                pos.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
                pos.y = radius * Math.sin(rotationX);
                pos.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
                camera.position.copy(pos);
                camera.lookAt(0, 0, 0);
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

    // iOS 用：モーションアクセス許可リクエスト
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
