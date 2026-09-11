import Post from "./models/Post.js";
import User from "./models/User.js";
import Message from "./models/Message.js";

export async function hardDeleteUser(userId) {
  await Post.deleteMany({ author: userId });

  await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });

  await Post.updateMany({}, { $pull: { comments: { user: userId } } });

  await User.updateMany(
    { $or: [{ followers: userId }, { following: userId }] },
    { $pull: { followers: userId, following: userId } }
  );

  await Message.deleteMany({
    $or: [{ sender: userId }, { recipient: userId }],
  });

  await User.deleteOne({ _id: userId });
}