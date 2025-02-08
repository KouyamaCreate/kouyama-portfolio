"use client";
import React, { useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function Page() {
    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        // シーンの作成
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // PerspectiveCamera の作成（一点透視、広角）
        const camera = new THREE.PerspectiveCamera(
            75, // 視野角(FOV) ※値を大きくすると広角に見えます
            canvasWidth / canvasHeight,
            0.1,
            1000
        );
        // カメラはシーン中心付近に配置（必要に応じて調整）
        camera.position.set(0, 0, 4);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        let mouseX: number = canvasWidth / 2;
        let mouseY: number = canvasHeight / 2;
        //let moveX: number = 0;
        //let moveY: number = 0;
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

        // ★ ライティングの追加 ★
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(100, 100, 100);
        scene.add(directionalLight);

        // マウス座標用変数（初期は画面中心）
        //let mouseX: number = canvasWidth / 2;
        //let mouseY: number = canvasHeight / 2;

        // Blenderで作成した部屋モデル（glTF形式）の読み込み
        let roomModel: THREE.Object3D | null = null;
        const loader = new GLTFLoader();
        loader.load(
            "/models/room.glb", // publicフォルダなどに配置したモデルのパス
            (gltf) => {
                roomModel = gltf.scene;

                const targetMaterialName = "display"; // 変更したいマテリアルの名前
                //const newColor = new THREE.Color(0xff0000); // 赤色に変更

                roomModel.traverse((object) => {
                    if ((object as THREE.Mesh).isMesh) {
                        const mesh = object as THREE.Mesh;
                        if (Array.isArray(mesh.material)) {
                            // マルチマテリアルの場合
                            mesh.material.forEach((material) => {
                                if (material.name === targetMaterialName) {
                                    //(material as THREE.MeshStandardMaterial).map = new THREE.TextureLoader().load("/textures/test.png");
                                    const video = document.createElement('video');
                                    video.src = "/textures/test.mp4";
                                    video.muted = true;
                                    video.loop = true;
                                    video.load();
                                    video.play();
                                    // 動画テクスチャ作成
                                    const texture = new THREE.VideoTexture(video);
                                    // 1テクセルが1ピクセルより大きな範囲をカバーするときのテクスチャサンプリング方法の指定
                                    texture.magFilter = THREE.LinearFilter;
                                    // 1テクセルが1ピクセルより小さな範囲をカバーするときのテクスチャサンプリング方法の指定
                                    texture.minFilter = THREE.LinearFilter;
                                    // 動画テクスチャフォーマットの指定
                                    texture.format = THREE.RGBFormat;
                                    (material as THREE.MeshStandardMaterial).map = texture;
                                }
                            });
                        } else {
                            // 単一マテリアルの場合
                            if (mesh.material.name === targetMaterialName) {
                                //(mesh.material as THREE.MeshStandardMaterial).map = new THREE.TextureLoader().load("/textures/test.png");
                                const video = document.createElement('video');
                                video.src = "/textures/test.mp4";
                                video.muted = true;
                                video.loop = true;
                                video.load();
                                // 動画テクスチャ作成
                                const texture = new THREE.VideoTexture(video);
                                // 1テクセルが1ピクセルより大きな範囲をカバーするときのテクスチャサンプリング方法の指定
                                texture.magFilter = THREE.LinearFilter;
                                // 1テクセルが1ピクセルより小さな範囲をカバーするときのテクスチャサンプリング方法の指定
                                texture.minFilter = THREE.LinearFilter;
                                // 動画テクスチャフォーマットの指定
                                texture.format = THREE.RGBFormat;
                                (mesh.material as THREE.MeshStandardMaterial).map = texture;
                                video.play();
                            }
                        }
                    }
                });


                // 初期はワールド原点に配置（更新処理で位置を調整します）
                roomModel.position.set(0, 0, 0);
                scene.add(roomModel);
            },
            undefined,
            (error) => {
                console.error("Error loading model", error);
            }
        );

        // マウスカーソルに追従する円の作成
        //const circleSize: number = 1;
        const circleGeometry = new THREE.CircleGeometry(circleSize / 2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false });
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        circleMesh.renderOrder = 9999;
        scene.add(circleMesh);

        // 部屋モデルの回転補間用変数
        let targetAngleX = 0;
        let targetAngleY = 0;
        let currentAngleX = 0;
        let currentAngleY = 0;
        const animationSpeed = 0.3;

        /*  
          PerspectiveCamera を用いる場合、シーンの座標系はワールド座標となるため、
          以下の updateScene では、マウスの画面中心からのピクセルオフセットを、
          100 で除算して小さなワールド座標オフセットに変換しています。
          この係数はモデルの大きさや好みに合わせて調整してください。
        */
        const updateScene = () => {
            // マウス中心からのオフセット（ピクセル値）
            //const offsetX = mouseX - canvasWidth / 2;
            //const offsetY = canvasHeight / 2 - mouseY; // Y軸は上方向が正
            // これをワールド座標系に変換（ここでは 100 で割る例）
            //const worldOffsetX = offsetX / 100;
            //const worldOffsetY = offsetY / 100;

            if (roomModel) {
                roomModel.position.set(0, 0, 0);

                const moveX = (mouseX - canvasWidth / 2) / 10;
                const moveY = (canvasHeight / 2 - mouseY) / 10; // Y軸を反転

                // 回転角度の設定（マウスオフセットが一定以上の場合に傾きを付与）
                /*if (offsetY > 50) {
                    targetAngleX = Math.PI / 8;
                } else if (offsetY < -50) {
                    targetAngleX = -Math.PI / 8;
                } else {
                    targetAngleX = 0;
                }
                if (offsetX > 50) {
                    targetAngleY = -Math.PI / 8;
                } else if (offsetX < -50) {
                    targetAngleY = Math.PI / 8;
                } else {
                    targetAngleY = 0;
                }*/
                targetAngleX = moveY / 100;
                targetAngleY = moveX / 100;

                currentAngleX += (targetAngleX - currentAngleX) * animationSpeed;
                currentAngleY += (targetAngleY - currentAngleY) * animationSpeed;
                //roomModel.rotation.x = currentAngleX;
                //roomModel.rotation.y = currentAngleY;

                //camera.lookAt(new THREE.Vector3(currentAngleY, currentAngleX, -1));

                // モデルのスケール調整：ここでは固定のスケールにしていますが、ウィンドウサイズに合わせることも可能
                roomModel.scale.set(canvasWidth / 300, canvasHeight / 300, 2.5); // 適宜調整してください
            }

            // 追加: 回転用にマウスオフセットを角度に変換し、カメラを更新
            const rotationX = -1 * (mouseY - canvasHeight / 2) * 0.00012;
            const rotationY = (mouseX - canvasWidth / 2) * 0.00003;
            const radius = 4; // カメラが原点から離れる半径

            camera.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
            camera.position.y = radius * Math.sin(rotationX);
            camera.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
            camera.lookAt(0, 0, 0);

            // 部屋のサイズはキャンバスの半分
            roomSizeX = canvasWidth / 2;
            roomSizeY = canvasHeight / 2;

            const roomX = canvasWidth / 2 - roomSizeX / 2;
            const roomY = canvasHeight / 2 - roomSizeY / 2;
            //const roomCenterX = roomX + roomSizeX / 2;
            //const roomCenterY = roomY + roomSizeY / 2;

            // 円の更新（マウスカーソル位置の縦反転対応）
            //const circleX = mouseX;
            //const circleY = canvasHeight - mouseY; // Y軸を反転
            // circleMesh.position.set(circleX, circleY, 0);

            // 傾きの計算（領域に応じて角度設定）
            if (mouseY < roomY) {
                targetAngleX = -Math.PI / 4; // 上
                targetAngleY = 0;
            } else if (mouseY > roomY + roomSizeY) {
                targetAngleX = Math.PI / 4; // 下
                targetAngleY = 0;
            } else if (mouseX < roomX) {
                targetAngleX = 0;
                targetAngleY = -Math.PI / 8; // 左
            } else if (mouseX > roomX + roomSizeX) {
                targetAngleX = 0;
                targetAngleY = Math.PI / 8; // 右
            } else {
                targetAngleX = 0; // 中央
                targetAngleY = 0;
            }

            // 角度を線形補間でスムーズに変化
            //currentAngleX += (targetAngleX - currentAngleX) * animationSpeed;
            // currentAngleY += (targetAngleY - currentAngleY) * animationSpeed;

            // 円の傾きを適用
            circleMesh.rotation.x = targetAngleX;
            circleMesh.rotation.y = targetAngleY;
        };

        const animate = () => {
            requestAnimationFrame(animate);
            updateScene();
            renderer.render(scene, camera);
        };
        animate();

        function handleDeviceOrientation(event: DeviceOrientationEvent) {
            if (event.beta !== null && event.gamma !== null) {
                // β, γ を利用して傾きを計算
                // ここでは簡易例として適当に割り算などします
                const beta = event.beta;   // -180~180
                const gamma = event.gamma; // -90~90
                targetAngleX = THREE.MathUtils.degToRad(beta / 10);
                targetAngleY = THREE.MathUtils.degToRad(gamma / 10);
                circleMesh.rotation.x = targetAngleX;
                circleMesh.rotation.y = targetAngleY;
            }
        }

        // スマホなら deviceorientation、PCならマウス移動
        if ("DeviceOrientationEvent" in window) {
            window.addEventListener("deviceorientation", handleDeviceOrientation);
        } else {
            (window as Window & typeof globalThis).addEventListener("mousemove", (event) => {
                mouseX = event.clientX;
                mouseY = event.clientY;

                // マウス座標を -1〜1 の正規化デバイス座標へ
                pointer.x = (mouseX / canvasWidth) * 2 - 1;
                pointer.y = -(mouseY / canvasHeight) * 2 + 1;

                // Raycaster をセット
                raycaster.setFromCamera(pointer, camera);

                // Z=0 平面との交点を計算
                const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                const intersection = new THREE.Vector3();
                raycaster.ray.intersectPlane(planeZ, intersection);

                // 円を交点に配置
                circleMesh.position.copy(intersection);
            });
        }

        // ウィンドウリサイズイベント
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
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
        };
    }, []);

    return (
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
    );
}