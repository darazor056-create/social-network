# Cоцсеть (MERN)

Полноценная соцсеть на React + Node.js + MongoDB:

- профили, регистрация и JWT-авторизация
- лента постов (текст + картинка), лайки, комментарии
- подписки/подписчики
- личные сообщения в реальном времени (Socket.IO)

## Структура

```
соцсеть/
├── client/   # React (Vite), страницы и компоненты
└── server/   # Express API + Socket.IO, Mongoose
```

## Требования

- Node.js 18+
- MongoDB — локальная (Community Server) или Atlas в облаке

## Запуск

### 1. База данных

Локально: установите MongoDB Community Server (https://www.mongodb.com/try/download/community)
и запустите службу — порт по умолчанию `27017`.

Или используйте бесплатный кластер MongoDB Atlas: создайте базу и вставьте
connection string в `MONGO_URI`.

### 2. Бэкенд

```bash
cd server
copy .env.example .env   # Windows
# отредактируйте .env при необходимости (MONGO_URI, JWT_SECRET)
npm install
npm run dev
```

Сервер поднимется на http://localhost:5000

### 3. Фронтенд

```bash
cd client
npm install
npm run dev
```

Откройте http://localhost:5173

## Проект

1. Зарегистрируйте двух пользователей в разных браузерах (или инкогнито).
2. Во вкладке «Люди» найдите друг друга и подпишитесь.
3. Публикуйте посты, ставьте лайки, комментируйте.
4. Пишите сообщения — они приходят мгновенно через WebSocket.

## API (кратко)

| Метод | Путь | Назначение |
|---|---|---|
| POST | /api/auth/register | регистрация |
| POST | /api/auth/login | вход |
| GET | /api/auth/me | текущий пользователь |
| GET | /api/users/search?q= | поиск по нику |
| GET/PUT | /api/users/me | профиль себя |
| GET | /api/users/:id | чужой профиль |
| POST/DELETE | /api/users/:id/follow | подписка/отписка |
| GET | /api/users/:id/followers,/:id/following | списки |
| GET | /api/posts/feed | лента |
| POST | /api/posts | создать пост |
| DELETE | /api/posts/:id | удалить пост |
| POST | /api/posts/:id/like | лайк/анлайк |
| POST | /api/posts/:id/comments | комментарий |
| DELETE | /api/posts/:id/comments/:cid | удалить комментарий |
| GET | /api/messages/conversations | диалоги |
| GET | /api/messages/:userId | переписка |
| POST | /api/messages/:userId | сообщение (REST fallback) |