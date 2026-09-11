let io = null;

export const setIO = (i) => {
  io = i;
};

export const emit = (room, event, payload) => {
  if (io) io.to(room).emit(event, payload);
};