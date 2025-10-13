# Docker 部署指南

## v2.0.0 新特性

### 多 API Key 支持
- **多Key轮询** - 支持配置多个FACTORY_API_KEY，自动在key之间轮询
- **分号分隔** - 环境变量中使用`;`分隔多个key
- **文件配置** - 支持从`factory_keys.txt`文件读取多个key
- **统计监控** - `/status`接口实时展示key和endpoint统计信息

### 自动Key管理
- **402自动废弃** - 响应402状态码时自动废弃对应的key
- **故障隔离** - 自动隔离失效key，保持系统稳定
- **可配置** - 通过`remove_on_402`配置开关（默认开启）

## 本地 Docker 部署

### 1. 准备环境变量

创建 `.env` 文件（从 `.env.example` 复制）：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置认证方式（按优先级选择其一）：

```env
# 方式1a：使用单个固定API密钥（推荐生产环境）
FACTORY_API_KEY=your_factory_api_key_here

# 方式1b：使用多个API密钥（分号分隔，支持轮询）
FACTORY_API_KEY=key1;key2;key3

# 方式1c：使用factory_keys.txt文件（在docker-compose.yml中挂载）
# 创建 factory_keys.txt，每行一个key

# 方式2：使用refresh token自动刷新
DROID_REFRESH_KEY=your_actual_refresh_token_here
```

**优先级：FACTORY_API_KEY/factory_keys.txt > DROID_REFRESH_KEY > 客户端authorization**

### 1.1 使用factory_keys.txt文件（可选）

如果使用文件配置多个key，在项目根目录创建 `factory_keys.txt`：

```bash
cat > factory_keys.txt << EOF
key1
key2
key3
# 注释行会被忽略
EOF
```

然后在 `docker-compose.yml` 中添加volume映射：

```yaml
services:
  droid2api:
    volumes:
      - ./factory_keys.txt:/app/factory_keys.txt:ro
```

### 2. 使用 Docker Compose 启动

```bash
docker-compose up -d
```

查看日志：

```bash
docker-compose logs -f
```

停止服务：

```bash
docker-compose down
```

### 3. 使用原生 Docker 命令

**构建镜像：**

```bash
docker build -t droid2api:latest .
```

**运行容器：**

```bash
# 方式1a：使用单个固定API密钥
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -e FACTORY_API_KEY="your_factory_api_key_here" \
  droid2api:latest

# 方式1b：使用多个API密钥（分号分隔）
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -e FACTORY_API_KEY="key1;key2;key3" \
  droid2api:latest

# 方式1c：使用factory_keys.txt文件
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -v $(pwd)/factory_keys.txt:/app/factory_keys.txt:ro \
  droid2api:latest

# 方式2：使用refresh token
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -e DROID_REFRESH_KEY="your_refresh_token_here" \
  droid2api:latest
```

**查看日志：**

```bash
docker logs -f droid2api
```

**停止容器：**

```bash
docker stop droid2api
docker rm droid2api
```

## 云平台部署

### Render.com 部署

1. 在 Render 创建新的 Web Service
2. 连接你的 GitHub 仓库
3. 配置：
   - **Environment**: Docker
   - **Branch**: multi-key-support
   - **Port**: 3000
4. 添加环境变量（选择其一）：
   - `FACTORY_API_KEY`: 单个或多个API密钥（分号分隔）
   - `DROID_REFRESH_KEY`: refresh token
5. 点击 "Create Web Service"
6. 访问 `https://your-app.onrender.com/status` 查看统计信息

### Railway 部署

1. 在 Railway 创建新项目
2. 选择 "Deploy from GitHub repo"
3. 选择分支：docker-deploy
4. Railway 会自动检测 Dockerfile
5. 添加环境变量（选择其一）：
   - `FACTORY_API_KEY`: 固定API密钥（推荐）
   - `DROID_REFRESH_KEY`: refresh token
6. 部署完成后会自动分配域名

### Fly.io 部署

1. 安装 Fly CLI：
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. 登录：
   ```bash
   fly auth login
   ```

3. 初始化应用（在项目目录）：
   ```bash
   fly launch
   ```

4. 设置环境变量（选择其一）：
   ```bash
   # 使用固定API密钥（推荐）
   fly secrets set FACTORY_API_KEY="your_factory_api_key_here"
   
   # 或使用refresh token
   fly secrets set DROID_REFRESH_KEY="your_refresh_token_here"
   ```

5. 部署：
   ```bash
   fly deploy
   ```

### Google Cloud Run 部署

1. 构建并推送镜像：
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/droid2api
   ```

2. 部署到 Cloud Run：
   ```bash
   # 使用固定API密钥（推荐）
   gcloud run deploy droid2api \
     --image gcr.io/YOUR_PROJECT_ID/droid2api \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars FACTORY_API_KEY="your_factory_api_key_here" \
     --port 3000
   
   # 或使用refresh token
   gcloud run deploy droid2api \
     --image gcr.io/YOUR_PROJECT_ID/droid2api \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars DROID_REFRESH_KEY="your_refresh_token_here" \
     --port 3000
   ```

### AWS ECS 部署

1. 创建 ECR 仓库
2. 推送镜像到 ECR
3. 创建 ECS 任务定义
4. 配置环境变量（选择其一）：
   - `FACTORY_API_KEY`（推荐）
   - `DROID_REFRESH_KEY`
5. 创建 ECS 服务

## 持久化配置

如果需要持久化刷新的 tokens：

### Docker Compose 方式

修改 `docker-compose.yml`：

```yaml
services:
  droid2api:
    volumes:
      - auth-data:/app
      
volumes:
  auth-data:
```

### Docker 命令方式

```bash
docker volume create droid2api-data

# 使用固定API密钥
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -e FACTORY_API_KEY="your_factory_api_key_here" \
  -v droid2api-data:/app \
  droid2api:latest

# 或使用refresh token
docker run -d \
  --name droid2api \
  -p 3000:3000 \
  -e DROID_REFRESH_KEY="your_refresh_token_here" \
  -v droid2api-data:/app \
  droid2api:latest
```

## 健康检查

容器启动后，可以通过以下端点检查服务状态：

```bash
# 基本信息
curl http://localhost:3000/

# 模型列表
curl http://localhost:3000/v1/models

# 统计信息（新增）
curl http://localhost:3000/status
# 或在浏览器中打开 http://localhost:3000/status
```

**Status页面功能：**
- 实时更新时间和自动刷新功能
- 当前配置（算法、402废弃开关、key数量）
- 端点请求统计
- 活跃key统计
- 废弃key列表（显示被402自动废弃的key）

## 环境变量说明

| 变量名 | 必需 | 优先级 | 说明 |
|--------|------|--------|------|
| `FACTORY_API_KEY` | 否 | 最高 | API密钥，支持单个或多个（分号分隔）。推荐生产环境使用 |
| `DROID_REFRESH_KEY` | 否 | 次高 | Factory refresh token，用于自动刷新 API key |
| `NODE_ENV` | 否 | - | 运行环境，默认 production |

**注意**：
- `FACTORY_API_KEY` 和 `DROID_REFRESH_KEY` 至少配置一个
- `FACTORY_API_KEY` 支持多个key（使用`;`分隔）：`key1;key2;key3`
- 或者使用 `factory_keys.txt` 文件（需要挂载到容器）

## 配置文件说明

### config.json

编辑 `config.json` 配置key选取算法和自动废弃功能：

```json
{
  "port": 3000,
  "round-robin": "weighted",    // 或 "simple"
  "remove_on_402": true,         // 是否在402时自动废弃key
  ...
}
```

**round-robin 算法：**
- `weighted` - 基于key健康度的加权轮询（默认，推荐）
- `simple` - 简单顺序轮询

**remove_on_402 配置：**
- `true` - 自动废弃返回402的key（默认，推荐）
  - 适合生产环境，自动处理失效key
  - key配额耗尽或失效时自动隔离
- `false` - 不自动废弃，继续使用所有key
  - 适合测试环境或需要手动管理key

## 故障排查

### 容器无法启动

查看日志：
```bash
docker logs droid2api
```

常见问题：
- 缺少认证配置（`FACTORY_API_KEY` 或 `DROID_REFRESH_KEY`）
- API密钥或refresh token 无效或过期
- 端口 3000 已被占用

### API 请求返回 401

**原因**：API密钥或refresh token 过期或无效

**解决**：
1. 如果使用 `FACTORY_API_KEY`：检查密钥是否有效
2. 如果使用 `DROID_REFRESH_KEY`：获取新的 refresh token
3. 更新环境变量
4. 重启容器

### API 请求返回 402

**原因**：Key配额耗尽或key失效

**自动处理**（当 `remove_on_402: true`）：
- 系统自动标记该key为废弃
- 该key不再参与后续轮询
- 其他正常key继续工作
- 在`/status`页面查看废弃key列表

**手动处理**：
1. 检查key配额状态
2. 更换新的有效key
3. 重启容器加载新配置

### 容器频繁重启

检查健康检查日志和应用日志，可能是：
- 内存不足
- API key 刷新失败
- 配置文件错误

## 安全建议

1. **不要将 `.env` 文件提交到 Git**
2. **使用 secrets 管理敏感信息**（如 GitHub Secrets、Docker Secrets）
3. **生产环境推荐使用 `FACTORY_API_KEY`**（更稳定，无需刷新）
4. **定期更新 API 密钥和 refresh token**
5. **启用 HTTPS**（云平台通常自动提供）
6. **限制访问来源**（通过防火墙或云平台配置）

## 性能优化

### 多阶段构建（可选）

```dockerfile
# 构建阶段
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 生产阶段
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 资源限制

在 docker-compose.yml 中添加：

```yaml
services:
  droid2api:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## 监控和日志

### 查看实时日志

```bash
docker-compose logs -f
```

### 导出日志

```bash
docker logs droid2api > droid2api.log 2>&1
```

### 集成监控工具

可以集成：
- Prometheus + Grafana
- Datadog
- New Relic
- Sentry（错误追踪）
