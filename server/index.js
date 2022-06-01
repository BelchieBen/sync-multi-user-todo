const express = require("express");
const socket = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const PatchManager = require("./PatchManager");
const { SyncStateRemote } = require("@syncstate/remote-server");
const remote = new SyncStateRemote();
const app = express();
const server = app.listen(8000, function () {
  console.log("listening on port 8000");
});

const io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const projectId = uuidv4();  //generate unique id 

let patchManager = new PatchManager();

io.on("connection", async (socket) => {
  console.log("Socket open");
  socket.on("fetchDoc", (path) => {
    //get all patches
    const patchesList = patchManager.getAllPatches(projectId, path);
    console.log("Patches List ",patchesList);

    if (patchesList.length !== 0) {
      //send each patch to the client
      patchesList.forEach((change) => {
        console.log("Change Sent ", change);
        socket.emit("change", path, change);
      });
    }
  });

  //patches recieved from the client
  socket.on("change", (path, change) => {
    change.origin = socket.id;

    //resolves conflicts internally
    remote.processChange(socket.id, path, change);
  });

  const dispose = remote.onChangeReady(socket.id, (path, change) => {
    //store the patches in js runtime or a persistent storage
    patchManager.store(projectId, path, change);

    //broadcast the pathes to other clients
    socket.broadcast.emit("change", path, change);
  });
});
