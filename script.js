"use strict";


/* =========================================
   SOCKET CONNECTION
========================================= */

const socket = io();


/* =========================================
   STATE
========================================= */

let currentRoom = null;
let currentRole = null;


/* =========================================
   DOM
========================================= */

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const createRoomModal =
    document.getElementById("createRoomModal");

const joinRoomModal =
    document.getElementById("joinRoomModal");

const roomCreatedModal =
    document.getElementById("roomCreatedModal");

const closeCreateModal =
    document.getElementById("closeCreateModal");

const closeJoinModal =
    document.getElementById("closeJoinModal");

const closeRoomCreatedModal =
    document.getElementById("closeRoomCreatedModal");

const createRoomForm =
    document.getElementById("createRoomForm");

const joinRoomForm =
    document.getElementById("joinRoomForm");

const generatedRoomCode =
    document.getElementById("generatedRoomCode");

const generatedRoomPassword =
    document.getElementById("generatedRoomPassword");

const copyRoomCodeButton =
    document.getElementById("copyRoomCodeButton");

const enterRoomButton =
    document.getElementById("enterRoomButton");

const toast =
    document.getElementById("toast");

const toastMessage =
    document.getElementById("toastMessage");

const connectionDot =
    document.getElementById("connectionDot");

const connectionStatusText =
    document.getElementById("connectionStatusText");


/* =========================================
   INITIALIZE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        loadSavedRoom();

    }
);


/* =========================================
   SOCKET CONNECTED
========================================= */

socket.on("connect", () => {

    console.log(
        "Socket connected:",
        socket.id
    );


    updateConnectionStatus(
        true,
        "Server Connected"
    );

});


/* =========================================
   SOCKET DISCONNECTED
========================================= */

socket.on("disconnect", () => {

    console.log(
        "Socket disconnected"
    );


    updateConnectionStatus(
        false,
        "Server Offline"
    );

});


/* =========================================
   CREATE ROOM CONFIRMED
========================================= */

socket.on(
    "room-created",
    (data) => {

        console.log(
            "Room created:",
            data
        );


        if (!currentRoom) {
            return;
        }


        generatedRoomCode.textContent =
            formatRoomCode(
                currentRoom.roomCode
            );


        generatedRoomPassword.textContent =
            currentRoom.password;


        closeModal(
            createRoomModal
        );


        openModal(
            roomCreatedModal
        );


        showToast(
            "Room created successfully."
        );

    }
);


/* =========================================
   ROOM JOINED
========================================= */

socket.on(
    "room-joined",
    (data) => {

        console.log(
            "Room joined:",
            data
        );


        currentRole =
            "guest";


        if (currentRoom) {

            currentRoom.roomName =
                data.roomName;

        }


        saveRoom(
            currentRoom
        );


        closeModal(
            joinRoomModal
        );


        showToast(
            "Room joined successfully."
        );


        /*
            Open transfer dashboard.
        */

        setTimeout(
            () => {

                openTransferRoom();

            },
            600
        );

    }
);


/* =========================================
   PEER JOINED
========================================= */

socket.on(
    "peer-joined",
    (data) => {

        console.log(
            "Peer joined:",
            data
        );


        showToast(
            "Another device joined the room!"
        );


        /*
            Host enters transfer room.
        */

        setTimeout(
            () => {

                openTransferRoom();

            },
            800
        );

    }
);


/* =========================================
   PEER READY
========================================= */

socket.on(
    "peer-ready",
    (data) => {

        console.log(
            "Peer ready:",
            data
        );

    }
);


/* =========================================
   ROOM ERROR
========================================= */

socket.on(
    "room-error",
    (data) => {

        console.error(
            "Room error:",
            data
        );


        showToast(
            data?.message ||
            "Room operation failed."
        );

    }
);


/* =========================================
   PEER DISCONNECTED
========================================= */

socket.on(
    "peer-disconnected",
    () => {

        console.log(
            "Peer disconnected."
        );


        showToast(
            "The other device disconnected."
        );

    }
);


/* =========================================
   WEBRTC SIGNALING
========================================= */

socket.on(
    "offer",
    (data) => {

        console.log(
            "WebRTC offer received.",
            data
        );

    }
);


socket.on(
    "answer",
    (data) => {

        console.log(
            "WebRTC answer received.",
            data
        );

    }
);


socket.on(
    "ice-candidate",
    (data) => {

        console.log(
            "ICE candidate received.",
            data
        );

    }
);


/* =========================================
   EVENTS
========================================= */

function setupEvents() {


    createRoomButton.addEventListener(
        "click",
        () => {

            openModal(
                createRoomModal
            );

        }
    );


    joinRoomButton.addEventListener(
        "click",
        () => {

            openModal(
                joinRoomModal
            );

        }
    );


    closeCreateModal.addEventListener(
        "click",
        () => {

            closeModal(
                createRoomModal
            );

        }
    );


    closeJoinModal.addEventListener(
        "click",
        () => {

            closeModal(
                joinRoomModal
            );

        }
    );


    closeRoomCreatedModal.addEventListener(
        "click",
        () => {

            closeModal(
                roomCreatedModal
            );

        }
    );


    createRoomForm.addEventListener(
        "submit",
        handleCreateRoom
    );


    joinRoomForm.addEventListener(
        "submit",
        handleJoinRoom
    );


    copyRoomCodeButton.addEventListener(
        "click",
        copyRoomCode
    );


    enterRoomButton.addEventListener(
        "click",
        enterCreatedRoom
    );


    document
        .querySelectorAll(".modal-overlay")
        .forEach(
            (overlay) => {

                overlay.addEventListener(
                    "click",
                    () => {

                        const modal =
                            overlay.closest(
                                ".modal"
                            );


                        if (modal) {

                            closeModal(
                                modal
                            );

                        }

                    }
                );

            }
        );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                document
                    .querySelectorAll(
                        ".modal.active"
                    )
                    .forEach(
                        (modal) => {

                            closeModal(
                                modal
                            );

                        }
                    );

            }

        }
    );


    const joinRoomCodeInput =
        document.getElementById(
            "joinRoomCode"
        );


    joinRoomCodeInput.addEventListener(
        "input",
        () => {

            let value =
                joinRoomCodeInput.value
                    .toUpperCase()
                    .replace(
                        /[^A-Z0-9]/g,
                        ""
                    );


            value =
                value.substring(
                    0,
                    8
                );


            if (
                value.length > 4
            ) {

                value =
                    value.substring(
                        0,
                        4
                    ) +
                    "-" +
                    value.substring(
                        4
                    );

            }


            joinRoomCodeInput.value =
                value;

        }
    );

}


/* =========================================
   CREATE ROOM
========================================= */

function handleCreateRoom(event) {

    event.preventDefault();


    if (!socket.connected) {

        showToast(
            "Server is not connected."
        );

        return;

    }


    const roomNameInput =
        document.getElementById(
            "roomName"
        );

    const roomPasswordInput =
        document.getElementById(
            "roomPassword"
        );


    const roomName =
        roomNameInput.value.trim();

    const password =
        roomPasswordInput.value;


    if (!roomName) {

        showToast(
            "Please enter a room name."
        );

        return;

    }


    if (
        password.length < 4
    ) {

        showToast(
            "Password must contain at least 4 characters."
        );

        return;

    }


    const roomCode =
        generateRoomCode();


    currentRoom = {

        roomName:
            roomName,

        roomCode:
            roomCode,

        password:
            password,

        role:
            "host",

        createdAt:
            Date.now()

    };


    currentRole =
        "host";


    saveRoom(
        currentRoom
    );


    socket.emit(
        "create-room",
        {

            roomCode:
                roomCode,

            password:
                password,

            roomName:
                roomName

        }
    );

}


/* =========================================
   JOIN ROOM
========================================= */

function handleJoinRoom(event) {

    event.preventDefault();


    if (!socket.connected) {

        showToast(
            "Server is not connected."
        );

        return;

    }


    const roomCodeInput =
        document.getElementById(
            "joinRoomCode"
        );

    const passwordInput =
        document.getElementById(
            "joinRoomPassword"
        );


    const roomCode =
        roomCodeInput.value
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ""
            );


    const password =
        passwordInput.value;


    if (
        roomCode.length !== 8
    ) {

        showToast(
            "Please enter a valid room code."
        );

        return;

    }


    if (!password) {

        showToast(
            "Please enter the password."
        );

        return;

    }


    currentRoom = {

        roomCode:
            roomCode,

        password:
            password,

        role:
            "guest",

        joinedAt:
            Date.now()

    };


    currentRole =
        "guest";


    socket.emit(
        "join-room",
        {

            roomCode:
                roomCode,

            password:
                password

        }
    );

}


/* =========================================
   OPEN TRANSFER ROOM
========================================= */

function openTransferRoom() {

    window.location.href =
        "/transfer.html";

}


/* =========================================
   ENTER CREATED ROOM
========================================= */

function enterCreatedRoom() {

    closeModal(
        roomCreatedModal
    );


    showToast(
        "Waiting for another device..."
    );

}


/* =========================================
   ROOM CODE
========================================= */

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let code = "";


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        code +=
            characters[
                Math.floor(
                    Math.random() *
                    characters.length
                )
            ];

    }


    return code;

}


function formatRoomCode(code) {

    if (!code) {

        return "---- ----";

    }


    return (
        code.substring(0, 4) +
        "-" +
        code.substring(4, 8)
    );

}


/* =========================================
   COPY
========================================= */

async function copyRoomCode() {

    if (
        !currentRoom?.roomCode
    ) {

        return;

    }


    const code =
        formatRoomCode(
            currentRoom.roomCode
        );


    try {

        await navigator.clipboard
            .writeText(code);

    }

    catch {

        const input =
            document.createElement(
                "textarea"
            );


        input.value =
            code;


        document.body.appendChild(
            input
        );


        input.select();


        document.execCommand(
            "copy"
        );


        input.remove();

    }


    copyRoomCodeButton.textContent =
        "✓ Copied";


    showToast(
        "Room code copied."
    );


    setTimeout(
        () => {

            copyRoomCodeButton.textContent =
                "📋 Copy Room Code";

        },
        2000
    );

}


/* =========================================
   MODALS
========================================= */

function openModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.add(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";

}


function closeModal(modal) {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "active"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    if (
        !document.querySelector(
            ".modal.active"
        )
    ) {

        document.body.style.overflow =
            "";

    }

}


/* =========================================
   CONNECTION STATUS
========================================= */

function updateConnectionStatus(
    connected,
    text
) {

    if (connectionDot) {

        connectionDot.classList.toggle(
            "connected",
            connected
        );

    }


    if (connectionStatusText) {

        connectionStatusText.textContent =
            text;

    }

}


/* =========================================
   STORAGE
========================================= */

function saveRoom(room) {

    if (!room) {
        return;
    }


    try {

        sessionStorage.setItem(
            "p2p_current_room",
            JSON.stringify(room)
        );

    }

    catch (error) {

        console.error(
            "Storage error:",
            error
        );

    }

}


function loadSavedRoom() {

    try {

        const saved =
            sessionStorage.getItem(
                "p2p_current_room"
            );


        if (!saved) {
            return;
        }


        currentRoom =
            JSON.parse(
                saved
            );


        currentRole =
            currentRoom?.role ||
            null;

    }

    catch {

        currentRoom =
            null;

        currentRole =
            null;

    }

}


/* =========================================
   TOAST
========================================= */

let toastTimer = null;


function showToast(message) {

    if (
        !toast ||
        !toastMessage
    ) {

        return;

    }


    toastMessage.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );

}


/* =========================================
   STARTUP LOG
========================================= */

console.log(
    "P2P Transfer client loaded."
);