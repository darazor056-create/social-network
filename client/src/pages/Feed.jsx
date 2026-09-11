import React, { useEffect, useState } from "react";
import api from "../api.js";
import PostCard from "../components/PostCard.jsx";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.get("/posts/feed");
      setPosts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="feed">
      {loading ? (
        <div className="center">Загрузка…</div>
      ) : posts.length === 0 ? (
        <div className="card empty">
          Лента пуста. Найдите людей во вкладке «Люди» и подпишитесь на них.
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={() => setPosts((p) => p.filter((x) => x.id !== post.id))} />
        ))
      )}
    </div>
  );
}