"use client";
import React, { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function Page() {
    // モーションパーミッションが必要かどうか、または許可済みかどうかの状態を管理
    const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
    const [motionPermissionGranted, setMotionPermissionGranted] = useState(false);
    // deviceorientation 用ハンドラーを外部から参照できるようにするための ref
    const deviceOrientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);

    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        // シーンの作成
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // PerspectiveCamera の作成
        const camera = new THREE.PerspectiveCamera(
            75,
            canvasWidth / canvasHeight,
            0.1,
            1000
        );
        camera.position.set(0, 0, 4);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        let mouseX: number = canvasWidth / 2;
        let mouseY: number = canvasHeight / 2;
        let roomSizeX: number = canvasWidth / 2;
        let roomSizeY: number = canvasHeight / 2;
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

        // Blenderで作成した部屋モデル（glTF形式）の読み込み
        let roomModel: THREE.Object3D | null = null;
        const loader = new GLTFLoader();
        loader.load(
            "/models/room.glb",
            (gltf) => {
                roomModel = gltf.scene;
                const targetMaterialName = "display";
                roomModel.traverse((object) => {
                    if ((object as THREE.Mesh).isMesh) {
                        const mesh = object as THREE.Mesh;
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach((material) => {
                                if (material.name === targetMaterialName) {
                                    const video = document.createElement("video");
                                    video.src = "/textures/test.mp4";
                                    video.muted = true;
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
                                video.src = "/textures/test.mp4";
                                video.muted = true;
                                video.loop = true;
                                video.load();
                                video.play();
                                const texture = new THREE.VideoTexture(video);
                                texture.magFilter = THREE.LinearFilter;
                                texture.minFilter = THREE.LinearFilter;
                                texture.format = THREE.RGBFormat;
                                (mesh.material as THREE.MeshStandardMaterial).map = texture;
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

        // 部屋モデルの回転補間用変数
        let targetAngleX = 0;
        let targetAngleY = 0;
        let currentAngleX = 0;
        let currentAngleY = 0;
        const animationSpeed = 0.3;

        // デバイスの向きを保持する変数
        let deviceRotationX = 0;
        let deviceRotationY = 0;

        // モバイル判定
        const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);

        // deviceorientation イベントハンドラー
        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta !== null && event.gamma !== null) {
                // event.beta: 前後の傾き（-180～180）、event.gamma: 左右の傾き（-90～90）
                deviceRotationX = THREE.MathUtils.degToRad(event.beta / 2);
                deviceRotationY = THREE.MathUtils.degToRad(event.gamma / 2);
                // オーバーレイの円にも反映（任意）
                circleMesh.rotation.x = deviceRotationX;
                circleMesh.rotation.y = deviceRotationY;
            }
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
                camera.position.x =
                    radius * Math.sin(deviceRotationY) * Math.cos(deviceRotationX);
                camera.position.y = radius * Math.sin(deviceRotationX);
                camera.position.z =
                    radius * Math.cos(deviceRotationY) * Math.cos(deviceRotationX);
            } else {
                // PCの場合はマウス座標から計算
                const rotationX = -1 * (mouseY - canvasHeight / 2) * 0.00012;
                const rotationY = (mouseX - canvasWidth / 2) * 0.00003;
                camera.position.x =
                    radius * Math.sin(rotationY) * Math.cos(rotationX);
                camera.position.y = radius * Math.sin(rotationX);
                camera.position.z =
                    radius * Math.cos(rotationY) * Math.cos(rotationX);
            }
            camera.lookAt(0, 0, 0);

            if (!isMobile) {
                raycaster.setFromCamera(pointer, camera);
                const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                const intersection = new THREE.Vector3();
                raycaster.ray.intersectPlane(planeZ, intersection);
                circleMesh.position.copy(intersection);

                const roomX = canvasWidth / 2 - roomSizeX / 2;
                const roomY = canvasHeight / 2 - roomSizeY / 2;
                if (mouseY < roomY) {
                    targetAngleX = -Math.PI / 4;
                    targetAngleY = 0;
                } else if (mouseY > roomY + roomSizeY) {
                    targetAngleX = Math.PI / 4;
                    targetAngleY = 0;
                } else if (mouseX < roomX) {
                    targetAngleX = 0;
                    targetAngleY = -Math.PI / 8;
                } else if (mouseX > roomX + roomSizeX) {
                    targetAngleX = 0;
                    targetAngleY = Math.PI / 8;
                } else {
                    targetAngleX = 0;
                    targetAngleY = 0;
                }
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
            // iOSの場合、requestPermission が存在するかを型アサーションで確認する
            if (
                typeof DeviceOrientationEvent !== "undefined" &&
                typeof (DeviceOrientationEvent as any).requestPermission === "function"
            ) {
                // ユーザー操作が必要なため、ボタン表示を促す
                setMotionPermissionNeeded(true);
            } else {
                // 許可不要なモバイル環境の場合は即登録
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
                window.removeEventListener(
                    "deviceorientation",
                    deviceOrientationHandlerRef.current
                );
            }
        };
    }, []);

    // iOSでモーションアクセス許可をリクエストするためのハンドラー
    const requestMotionPermission = () => {
        if (
            typeof DeviceOrientationEvent !== "undefined" &&
            typeof (DeviceOrientationEvent as any).requestPermission === "function"
        ) {
            (DeviceOrientationEvent as any)
                .requestPermission()
                .then((response: string) => {
                    if (response === "granted") {
                        setMotionPermissionGranted(true);
                        // deviceorientation 用ハンドラーを登録
                        if (deviceOrientationHandlerRef.current) {
                            window.addEventListener(
                                "deviceorientation",
                                deviceOrientationHandlerRef.current
                            );
                        }
                    } else {
                        console.warn("Motion permission not granted");
                    }
                })
                .catch((error: any) => {
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
            {/* モーションアクセスが必要な場合、ユーザーに許可ボタンを表示 */}
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
