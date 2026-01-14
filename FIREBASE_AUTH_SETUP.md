# Firebase 认证设置指南

本项目使用 Firebase 进行用户认证管理，支持匿名登录和邮箱账号绑定。

## 功能特性

1. **自动匿名登录**：用户首次访问应用时，系统自动创建匿名账号
2. **账号绑定**：用户可以将匿名账号绑定到邮箱，永久保存数据
3. **数据迁移**：账号绑定时自动调用后端 API 迁移用户数据
4. **全局状态管理**：使用 React Context 管理认证状态

## 设置步骤

### 1. 创建 Firebase 项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 点击"添加项目"，按照向导创建新项目
3. 在项目设置中启用 **Authentication**
4. 在 Authentication > Sign-in method 中启用：
   - **匿名登录（Anonymous）**
   - **电子邮件/密码（Email/Password）**

### 2. 获取 Firebase 配置

1. 在 Firebase Console 中，进入 **项目设置** > **常规**
2. 滚动到"您的应用"部分，选择 Web 应用（</>）
3. 如果没有 Web 应用，点击"添加应用"创建一个
4. 复制 Firebase 配置信息

### 3. 配置环境变量

1. 复制 `.env.local.example` 文件为 `.env.local`：
   ```bash
   copy .env.local.example .env.local
   ```

2. 填入你的 Firebase 配置信息：
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=你的_API_KEY
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=你的项目ID.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=你的项目ID
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=你的项目ID.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=你的_SENDER_ID
   NEXT_PUBLIC_FIREBASE_APP_ID=你的_APP_ID
   ```

### 4. 重启开发服务器

```bash
npm run dev
```

## 工作流程

### 用户首次访问
1. 用户打开应用
2. AuthProvider 检测到没有登录用户
3. 自动调用 `signInAnonymously()` 创建匿名账号
4. 用户可以正常使用应用功能

### 账号绑定
1. 用户点击"Bind Account"按钮进入登录页
2. 填写邮箱和密码
3. 系统调用 `linkAnonymousAccount()` 绑定账号
4. 自动调用 `/api/migrate-user-data` 迁移数据
5. 账号绑定成功，匿名账号转换为正式账号

### 已有账号登录
1. 如果用户已有账号，可以直接登录
2. 系统会合并匿名用户数据（如果需要）

## 代码结构

```
lib/
  ├── firebase.ts          # Firebase 初始化
  └── auth.tsx            # 认证上下文和钩子

components/
  └── Header.tsx          # 头部组件（显示登录状态）

app/
  ├── layout.tsx          # 根布局（包含 AuthProvider）
  ├── login/
  │   └── page.tsx        # 登录/绑定页面
  └── api/
      └── migrate-user-data/
          └── route.ts    # 数据迁移 API
```

## 使用认证钩子

在任何组件中使用 `useAuth` 钩子：

```tsx
import { useAuth } from '@/lib/auth'

function MyComponent() {
  const { 
    user,           // 当前用户对象
    loading,        // 加载状态
    isAnonymous,    // 是否为匿名用户
    linkAnonymousAccount,  // 绑定账号函数
    logout          // 登出函数
  } = useAuth()

  if (loading) return <div>加载中...</div>
  
  return (
    <div>
      {isAnonymous ? (
        <p>当前为临时账号，请绑定邮箱</p>
      ) : (
        <p>欢迎回来，{user?.email}</p>
      )}
    </div>
  )
}
```

## 数据迁移 API

当用户绑定账号时，系统会自动调用 `/api/migrate-user-data` API：

```typescript
// 请求
POST /api/migrate-user-data
{
  "anonymousUid": "匿名用户ID",
  "authenticatedUid": "认证用户ID"
}

// 响应
{
  "success": true,
  "message": "数据迁移成功",
  "migratedFrom": "匿名用户ID",
  "migratedTo": "认证用户ID"
}
```

**重要**：请根据您的数据结构实现实际的数据迁移逻辑，在 `app/api/migrate-user-data/route.ts` 中添加：
- 报告数据迁移
- 账单数据迁移
- 用户设置迁移
- 其他用户相关数据

## 安全注意事项

1. **环境变量**：`.env.local` 文件包含敏感信息，不要提交到版本控制
2. **Firebase 规则**：在 Firebase Console 中设置适当的安全规则
3. **API 验证**：数据迁移 API 应该验证用户身份（推荐使用 Firebase Admin SDK）

## 调试

在浏览器控制台查看认证日志：
- `用户已登录: 匿名用户 xxxxxxxx` - 匿名登录成功
- `账号绑定成功: user@example.com` - 账号绑定成功
- `数据迁移成功` - 数据迁移完成

## 常见问题

### Q: 匿名登录失败？
A: 检查 Firebase Console 中是否启用了匿名登录功能

### Q: 账号绑定时提示"该邮箱已被使用"？
A: 该邮箱已注册其他账号，请使用登录而不是绑定

### Q: 数据迁移失败？
A: 检查后端 API 实现，确保正确处理数据库更新

## 更多资源

- [Firebase Authentication 文档](https://firebase.google.com/docs/auth)
- [匿名登录指南](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [账号链接指南](https://firebase.google.com/docs/auth/web/account-linking)
