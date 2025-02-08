"use client";

import React, { useEffect } from "react";
import * as THREE from "three";

export default function Page() {
    useEffect(() => {
        let canvasWidth: number = window.innerWidth;
        let canvasHeight: number = window.innerHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        const camera = new THREE.OrthographicCamera(
            0, // left
            canvasWidth, // right
            canvasHeight, // top
            0, // bottom
            -1000, // near
            1000 // far
        );
        camera.position.set(0, 0, 500);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(canvasWidth, canvasHeight);

        const container = document.getElementById("three-container");
        if (container) {
            container.appendChild(renderer.domElement);
        }

        let mouseX: number = canvasWidth / 2;
        let mouseY: number = canvasHeight / 2;
        let moveX: number = 0;
        let moveY: number = 0;
        let roomSizeX: number = canvasWidth / 2;
        let roomSizeY: number = canvasHeight / 2;
        const circleSize: number = 50;

        // 部屋の矩形
        const roomGeometry = new THREE.PlaneGeometry(roomSizeX, roomSizeY);
        const roomMaterial = new THREE.MeshBasicMaterial({
            color: 0xdddddd,
            side: THREE.DoubleSide,
        });
        const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
        scene.add(roomMesh);

        // 四隅とつなぐ線
        const createLine = () => {
            const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
            );
            return new THREE.Line(geometry, lineMaterial);
        };
        const lineTopLeft = createLine();
        const lineTopRight = createLine();
        const lineBottomLeft = createLine();
        const lineBottomRight = createLine();
        scene.add(lineTopLeft, lineTopRight, lineBottomLeft, lineBottomRight);

        // マウスカーソル部分の円
        const circleGeometry = new THREE.CircleGeometry(circleSize / 2, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        scene.add(circleMesh);

        // 角度の設定
        let targetAngleX = 0;
        let targetAngleY = 0;
        let currentAngleX = 0;
        let currentAngleY = 0;
        const animationSpeed = 0.3;

        const updateScene = () => {
            // マウスの中心からのずれ（Y軸を反転）
            moveX = (mouseX - canvasWidth / 2) / 10;
            moveY = (canvasHeight / 2 - mouseY) / 10; // Y軸を反転

            // 部屋のサイズはキャンバスの半分
            roomSizeX = canvasWidth / 2;
            roomSizeY = canvasHeight / 2;

            const roomX = canvasWidth / 2 - roomSizeX / 2 + moveX;
            const roomY = canvasHeight / 2 - roomSizeY / 2 + moveY;
            const roomCenterX = roomX + roomSizeX / 2;
            const roomCenterY = roomY + roomSizeY / 2;

            // 部屋の矩形の更新
            roomMesh.geometry.dispose();
            roomMesh.geometry = new THREE.PlaneGeometry(roomSizeX, roomSizeY);
            roomMesh.position.set(roomCenterX, roomCenterY, 0);

            // 四隅と矩形の各頂点をつなぐ線の更新
            const updateLinePosition = (line: THREE.Line, start: number[], end: number[]) => {
                const positions = line.geometry.attributes.position.array as Float32Array;
                positions[0] = start[0];
                positions[1] = start[1];
                positions[2] = start[2];
                positions[3] = end[0];
                positions[4] = end[1];
                positions[5] = end[2];
                line.geometry.attributes.position.needsUpdate = true;
            };

            updateLinePosition(lineTopLeft, [0, 0, 0], [roomX, roomY, 0]);
            updateLinePosition(lineTopRight, [canvasWidth, 0, 0], [roomX + roomSizeX, roomY, 0]);
            updateLinePosition(lineBottomLeft, [0, canvasHeight, 0], [roomX, roomY + roomSizeY, 0]);
            updateLinePosition(lineBottomRight, [canvasWidth, canvasHeight, 0], [roomX + roomSizeX, roomY + roomSizeY, 0]);

            // 円の更新（マウスカーソル位置の縦反転対応）
            const circleX = mouseX;
            const circleY = canvasHeight - mouseY; // Y軸を反転
            circleMesh.position.set(circleX, circleY, 20);

            // 傾きの計算（領域に応じて角度設定）
            if (mouseY < roomY) {
                targetAngleX = -Math.PI / 4; // 上
                targetAngleY = 0;
            } else if (mouseY > roomY + roomSizeY) {
                targetAngleX = Math.PI / 4; // 下
                targetAngleY = 0;
            } else if (mouseX < roomX) {
                targetAngleX = 0;
                targetAngleY = -Math.PI / 4; // 左
            } else if (mouseX > roomX + roomSizeX) {
                targetAngleX = 0;
                targetAngleY = Math.PI / 4; // 右
            } else {
                targetAngleX = 0; // 中央
                targetAngleY = 0;
            }

            // 角度を線形補間でスムーズに変化
            currentAngleX += (targetAngleX - currentAngleX) * animationSpeed;
            currentAngleY += (targetAngleY - currentAngleY) * animationSpeed;

            // 円の傾きを適用
            circleMesh.rotation.x = currentAngleX;
            circleMesh.rotation.y = currentAngleY;
        };

        const animate = () => {
            requestAnimationFrame(animate);
            updateScene();
            renderer.render(scene, camera);
        };

        window.addEventListener("mousemove", (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
        });

        window.addEventListener("resize", () => {
            canvasWidth = window.innerWidth;
            canvasHeight = window.innerHeight;
            renderer.setSize(canvasWidth, canvasHeight);

            camera.left = 0;
            camera.right = canvasWidth;
            camera.top = canvasHeight;
            camera.bottom = 0;
            camera.updateProjectionMatrix();
        });

        animate();

        return () => {
            window.removeEventListener("mousemove", () => { });
            window.removeEventListener("resize", () => { });
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
                cursor: "none",  // ここでカーソルを非表示にしています
            }}
        />
    );
}
