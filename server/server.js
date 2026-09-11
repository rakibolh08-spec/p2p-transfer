const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;


/* =====================================================
   SERVE PROJECT
===================================================== */

app.use(express.static(path.join(__dirname, "..")));


/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "..", "index.html")
    );
});


/* =====================================================
   SERVER STATUS
===================================================== */

app.get("/api/status", (req, res) => {

    res.json({
        status: "online",
        message: "P2P Transfer signaling server is running."
    });

});


/* =====================================================
   ROOMS
===================================================== */

const rooms = new Map();


/* =====================================================
   SOCKET CONNECTION
===================================================== */

io.on("connection", (socket) => {

    console.log("");
    console.log("DEVICE CONNECTED:", socket.id);


    /* =================================================
       CREATE ROOM
    ================================================= */

    socket.on("create-room", (data) => {

        try {

            const roomCode = String(
                data?.roomCode || ""
            )
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");


            const password = String(
                data?.password || ""
            );


            const roomName = String(
                data?.roomName ||
                "P2P Transfer Room"
            ).trim();


            if (roomCode.length !== 8) {

                socket.emit("room-error", {
                    message:
                        "Room code must contain 8 characters."
                });

                return;
            }


            if (password.length < 4) {

                socket.emit("room-error", {
                    message:
                        "Password must contain at least 4 characters."
                });

                return;
            }


            if (rooms.has(roomCode)) {

                socket.emit("room-error", {
                    message:
                        "This room is already occupied."
                });

                return;
            }


            const room = {

                roomCode,
                roomName,
                password,

                host: socket.id,
                guest: null,

                createdAt: Date.now()

            };


            rooms.set(
                roomCode,
                room
            );


            socket.join(roomCode);

            socket.roomCode =
                roomCode;

            socket.role =
                "host";


            socket.emit(
                "room-created",
                {
                    roomCode,
                    roomName,
                    role: "host"
                }
            );


            console.log(
                `ROOM CREATED | ${roomCode} | HOST | ${socket.id}`
            );

        }
        catch (error) {

            console.error(
                "Create room error:",
                error
            );

        }

    });


    /* =================================================
       JOIN ROOM
    ================================================= */

    socket.on("join-room", (data) => {

        try {

            const roomCode = String(
                data?.roomCode || ""
            )
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");


            const password = String(
                data?.password || ""
            );


            joinRoom(
                socket,
                roomCode,
                password
            );

        }
        catch (error) {

            console.error(
                "Join room error:",
                error
            );

        }

    });


    /* =================================================
       REJOIN ROOM
    ================================================= */

    socket.on("rejoin-room", (data) => {

        try {

            const roomCode = String(
                data?.roomCode || ""
            )
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");


            const password = String(
                data?.password || ""
            );


            const role =
                data?.role;


            const room =
                rooms.get(roomCode);


            if (!room) {

                socket.emit("room-error", {
                    message:
                        "Room no longer exists."
                });

                return;
            }


            if (room.password !== password) {

                socket.emit("room-error", {
                    message:
                        "Room password verification failed."
                });

                return;
            }


            /* -----------------------------------------
               HOST RECONNECT
            ----------------------------------------- */

            if (role === "host") {

                if (
                    room.host &&
                    room.host !== socket.id
                ) {

                    const oldHost =
                        io.sockets.sockets.get(
                            room.host
                        );

                    if (oldHost) {

                        oldHost.roomCode =
                            null;

                        oldHost.role =
                            null;

                    }

                }


                room.host =
                    socket.id;

                socket.role =
                    "host";

            }


            /* -----------------------------------------
               GUEST RECONNECT
            ----------------------------------------- */

            else if (role === "guest") {

                if (
                    room.guest &&
                    room.guest !== socket.id
                ) {

                    const oldGuest =
                        io.sockets.sockets.get(
                            room.guest
                        );

                    if (oldGuest) {

                        oldGuest.roomCode =
                            null;

                        oldGuest.role =
                            null;

                    }

                }


                room.guest =
                    socket.id;

                socket.role =
                    "guest";

            }


            else {

                socket.emit("room-error", {
                    message:
                        "Invalid room role."
                });

                return;
            }


            socket.join(roomCode);

            socket.roomCode =
                roomCode;


            socket.emit(
                "room-reconnected",
                {
                    roomCode,
                    roomName:
                        room.roomName,
                    role:
                        socket.role
                }
            );


            console.log(
                `ROOM RECONNECTED | ${roomCode} | ${socket.role} | ${socket.id}`
            );


            /* -----------------------------------------
               If both devices are present
            ----------------------------------------- */

            if (
                room.host &&
                room.guest
            ) {

                io.to(room.host).emit(
                    "peer-joined",
                    {
                        peerId:
                            room.guest,
                        roomCode
                    }
                );


                io.to(room.guest).emit(
                    "peer-ready",
                    {
                        peerId:
                            room.host,
                        roomCode
                    }
                );


                console.log(
                    `PEERS READY | ${roomCode}`
                );

            }

        }
        catch (error) {

            console.error(
                "Rejoin room error:",
                error
            );

        }

    });


    /* =================================================
       WEBRTC OFFER
    ================================================= */

    socket.on("offer", (data) => {

        if (!socket.roomCode) {

            console.warn(
                "Offer received without room:",
                socket.id
            );

            return;
        }


        socket.to(
            socket.roomCode
        ).emit(
            "offer",
            {
                offer:
                    data?.offer,
                from:
                    socket.id
            }
        );


        console.log(
            `OFFER RELAYED | ${socket.roomCode}`
        );

    });


    /* =================================================
       WEBRTC ANSWER
    ================================================= */

    socket.on("answer", (data) => {

        if (!socket.roomCode) {

            console.warn(
                "Answer received without room:",
                socket.id
            );

            return;
        }


        socket.to(
            socket.roomCode
        ).emit(
            "answer",
            {
                answer:
                    data?.answer,
                from:
                    socket.id
            }
        );


        console.log(
            `ANSWER RELAYED | ${socket.roomCode}`
        );

    });


    /* =================================================
       ICE CANDIDATE
    ================================================= */

    socket.on(
        "ice-candidate",
        (data) => {

            if (!socket.roomCode) {

                console.warn(
                    "ICE received without room:",
                    socket.id
                );

                return;
            }


            if (!data?.candidate) {

                return;
            }


            socket.to(
                socket.roomCode
            ).emit(
                "ice-candidate",
                {
                    candidate:
                        data.candidate,
                    from:
                        socket.id
                }
            );

        }
    );


    /* =================================================
       TRANSFER CANCELLED
    ================================================= */

    socket.on(
        "transfer-cancelled",
        () => {

            if (!socket.roomCode) {

                return;
            }


            socket.to(
                socket.roomCode
            ).emit(
                "transfer-cancelled"
            );

        }
    );


    /* =================================================
       DISCONNECT
    ================================================= */

    socket.on("disconnect", () => {

        console.log(
            "DEVICE DISCONNECTED:",
            socket.id
        );


        const roomCode =
            socket.roomCode;


        if (!roomCode) {

            return;
        }


        const room =
            rooms.get(roomCode);


        if (!room) {

            return;
        }


        /* -----------------------------------------
           Notify other device
        ----------------------------------------- */

        if (
            room.host === socket.id ||
            room.guest === socket.id
        ) {

            socket.to(
                roomCode
            ).emit(
                "peer-disconnected"
            );

        }


        /* -----------------------------------------
           Remove disconnected socket
        ----------------------------------------- */

        if (
            room.host === socket.id
        ) {

            room.host =
                null;

        }


        if (
            room.guest === socket.id
        ) {

            room.guest =
                null;

        }


        /*
           Keep room alive for 30 seconds.

           This allows browser reconnect.
        */

        setTimeout(
            () => {

                const currentRoom =
                    rooms.get(roomCode);


                if (!currentRoom) {

                    return;
                }


                if (
                    !currentRoom.host &&
                    !currentRoom.guest
                ) {

                    rooms.delete(
                        roomCode
                    );


                    console.log(
                        `ROOM DELETED | ${roomCode}`
                    );

                }

            },
            30000
        );

    });

});


/* =====================================================
   JOIN ROOM FUNCTION
===================================================== */

function joinRoom(
    socket,
    roomCode,
    password
) {

    if (
        roomCode.length !== 8
    ) {

        socket.emit(
            "room-error",
            {
                message:
                    "Invalid room code."
            }
        );

        return;
    }


    const room =
        rooms.get(roomCode);


    if (!room) {

        socket.emit(
            "room-error",
            {
                message:
                    "Room not found."
            }
        );

        return;
    }


    if (
        room.password !== password
    ) {

        socket.emit(
            "room-error",
            {
                message:
                    "Incorrect room password."
            }
        );

        return;
    }


    /* -----------------------------------------
       Prevent duplicate guest
    ----------------------------------------- */

    if (
        room.guest &&
        room.guest !== socket.id
    ) {

        const oldGuest =
            io.sockets.sockets.get(
                room.guest
            );


        /*
           If old guest socket is actually
           disconnected, replace it.
        */

        if (
            !oldGuest ||
            !oldGuest.connected
        ) {

            room.guest =
                null;

        }
        else {

            socket.emit(
                "room-error",
                {
                    message:
                        "This room is already occupied."
                }
            );

            return;

        }

    }


    /* -----------------------------------------
       Add guest
    ----------------------------------------- */

    room.guest =
        socket.id;


    socket.join(
        roomCode
    );


    socket.roomCode =
        roomCode;

    socket.role =
        "guest";


    socket.emit(
        "room-joined",
        {
            roomCode,
            roomName:
                room.roomName,
            role:
                "guest"
        }
    );


    console.log(
        `ROOM JOINED | ${roomCode} | GUEST | ${socket.id}`
    );


    /* -----------------------------------------
       Tell host
    ----------------------------------------- */

    if (
        room.host
    ) {

        io.to(
            room.host
        ).emit(
            "peer-joined",
            {
                peerId:
                    socket.id,
                roomCode
            }
        );

    }


    /* -----------------------------------------
       Tell guest about host
    ----------------------------------------- */

    if (
        room.host
    ) {

        socket.emit(
            "peer-ready",
            {
                peerId:
                    room.host,
                roomCode
            }
        );

    }

}


/* =====================================================
   START SERVER
===================================================== */

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================="
        );

        console.log(
            "       P2P TRANSFER SERVER"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "================================="
        );

        console.log("");

    }
);


/* =====================================================
   SERVER ERROR
===================================================== */

server.on(
    "error",
    (error) => {

        if (
            error.code ===
            "EADDRINUSE"
        ) {

            console.error("");
            console.error(
                `ERROR: Port ${PORT} is already in use.`
            );

            console.error(
                "Stop the old server process first."
            );

            console.error("");

        }
        else {

            console.error(
                "Server error:",
                error
            );

        }

    }
);