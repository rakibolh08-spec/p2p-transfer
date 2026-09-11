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

const PORT = process.env.PORT || 3000;

/* =====================================================
   STATIC FILES
===================================================== */

app.use(express.static(path.join(__dirname, "..")));


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
    console.log("=================================");
    console.log("DEVICE CONNECTED");
    console.log("Socket:", socket.id);
    console.log("=================================");


    /* =================================================
       CREATE ROOM
    ================================================= */

    socket.on("create-room", (data) => {

        try {

            const roomCode =
                String(data?.roomCode || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");

            const password =
                String(data?.password || "");

            const roomName =
                String(
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

        const roomCode =
            String(data?.roomCode || "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");

        const password =
            String(data?.password || "");


        joinRoom(
            socket,
            roomCode,
            password
        );

    });


    /* =================================================
       REJOIN ROOM
    ================================================= */

    socket.on("rejoin-room", (data) => {

        try {

            const roomCode =
                String(data?.roomCode || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");

            const password =
                String(data?.password || "");

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


            /*
                Remove old socket references
                ONLY when necessary.
            */

            if (role === "host") {

                /*
                    If another socket is already the
                    active host, do not destroy it.
                */

                if (
                    room.host &&
                    room.host !== socket.id
                ) {

                    const oldHost =
                        io.sockets.sockets.get(
                            room.host
                        );

                    /*
                        Old socket may have disconnected
                        but still remain registered in room.
                    */

                    if (oldHost) {

                        oldHost.emit(
                            "peer-disconnected"
                        );

                    }

                }


                room.host =
                    socket.id;

                socket.role =
                    "host";

            }


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

                        oldGuest.emit(
                            "peer-disconnected"
                        );

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


            /*
                IMPORTANT:

                If both host and guest now exist,
                explicitly notify BOTH sides.

                This makes the WebRTC handshake start
                reliably after a page refresh/reconnect.
            */

            if (
                room.host &&
                room.guest
            ) {

                console.log(
                    `BOTH PEERS READY | ${roomCode}`
                );


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
       OFFER
    ================================================= */

    socket.on("offer", (data) => {

        try {

            if (!socket.roomCode) {
                return;
            }


            const room =
                rooms.get(
                    socket.roomCode
                );


            if (!room) {
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
                `OFFER | ${socket.roomCode} | ${socket.id}`
            );

        }
        catch (error) {

            console.error(
                "Offer error:",
                error
            );

        }

    });


    /* =================================================
       ANSWER
    ================================================= */

    socket.on("answer", (data) => {

        try {

            if (!socket.roomCode) {
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
                `ANSWER | ${socket.roomCode} | ${socket.id}`
            );

        }
        catch (error) {

            console.error(
                "Answer error:",
                error
            );

        }

    });


    /* =================================================
       ICE CANDIDATE
    ================================================= */

    socket.on("ice-candidate", (data) => {

        try {

            if (!socket.roomCode) {
                return;
            }


            socket.to(
                socket.roomCode
            ).emit(
                "ice-candidate",
                {
                    candidate:
                        data?.candidate,
                    from:
                        socket.id
                }
            );

        }
        catch (error) {

            console.error(
                "ICE candidate error:",
                error
            );

        }

    });


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
            `DEVICE DISCONNECTED | ${socket.id}`
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


        /*
            Notify the other peer.
        */

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


        /*
            Do NOT immediately delete the room.

            The browser may reconnect.
        */

        setTimeout(
            () => {

                const currentRoom =
                    rooms.get(roomCode);


                if (!currentRoom) {
                    return;
                }


                /*
                    Only remove this socket if
                    it is STILL the registered socket.

                    This is important because a new
                    socket may already have replaced it.
                */

                if (
                    currentRoom.host ===
                    socket.id
                ) {

                    currentRoom.host =
                        null;

                }


                if (
                    currentRoom.guest ===
                    socket.id
                ) {

                    currentRoom.guest =
                        null;

                }


                /*
                    Delete room only when both
                    devices are actually gone.
                */

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
            15000
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

    try {

        if (
            roomCode.length !== 8
        ) {

            socket.emit("room-error", {
                message:
                    "Invalid room code."
            });

            return;
        }


        const room =
            rooms.get(roomCode);


        if (!room) {

            socket.emit("room-error", {
                message:
                    "Room not found."
            });

            return;
        }


        if (
            room.password !== password
        ) {

            socket.emit("room-error", {
                message:
                    "Incorrect room password."
            });

            return;
        }


        /*
            A room can have only one guest.
        */

        if (
            room.guest &&
            room.guest !== socket.id
        ) {

            const oldGuest =
                io.sockets.sockets.get(
                    room.guest
                );


            /*
                If old guest socket is really
                still connected, reject new guest.
            */

            if (oldGuest) {

                socket.emit("room-error", {
                    message:
                        "This room is already occupied."
                });

                return;

            }


            /*
                Old socket no longer exists.
                Replace it.
            */

            room.guest =
                null;

        }


        room.guest =
            socket.id;


        socket.join(roomCode);

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


        /*
            Host exists -> both peers are ready.
        */

        if (room.host) {

            /*
                Tell host that guest joined.
            */

            io.to(room.host).emit(
                "peer-joined",
                {
                    peerId:
                        socket.id,
                    roomCode
                }
            );


            /*
                Tell guest that host exists.
            */

            socket.emit(
                "peer-ready",
                {
                    peerId:
                        room.host,
                    roomCode
                }
            );


            console.log(
                `BOTH PEERS READY | ${roomCode}`
            );

        }

    }
    catch (error) {

        console.error(
            "Join room error:",
            error
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