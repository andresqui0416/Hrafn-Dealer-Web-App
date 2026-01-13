-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('opened', 'accepted', 'closed');

-- CreateTable
CREATE TABLE "Chat" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "adminId" UUID,
    "subject" TEXT NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'opened',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "chatId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "senderType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chat_user" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "idx_chat_admin" ON "Chat"("adminId");

-- CreateIndex
CREATE INDEX "idx_chat_status" ON "Chat"("status");

-- CreateIndex
CREATE INDEX "idx_chat_created" ON "Chat"("createdAt");

-- CreateIndex
CREATE INDEX "idx_msg_chat" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "idx_msg_created" ON "Message"("createdAt");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "fk_chat_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "fk_chat_admin" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "fk_msg_chat" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
