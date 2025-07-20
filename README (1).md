# 🎥 Video Transcoding Pipeline with AWS, Docker, React & Cloud Deployments

This project is a full-stack, event-driven video transcoding pipeline using:

- **Frontend:** Vite + React
- **Backend:** Node.js / Express
- **Queue:** AWS SQS
- **Storage:** AWS S3 (Input and Output buckets)
- **Processing:** AWS ECS/Fargate and ECR (Dockerized transcoder)
- **Worker:** Node.js-based SQS consumer (deployed via Docker or serverless/background job)

---

## 📦 Project Structure

.
├── backend/ # Express API server (Node.js)
├── consumer/ # Background job (SQS consumer)
├── transcoder/ # Dockerized FFmpeg-based transcoding task
├── frontend/ # Vite + React UI
├── deploy/ # Terraform or deployment configs (optional)
└── README.md

---

## 🚀 Workflow

1. **User uploads video** using the frontend via a signed URL to **input S3 bucket**.
2. **S3 triggers an SSQS event** on object upload.
3. **Consumer service** receives the SQS message, parses it, and invokes a **transcoder task** using **ECS/Fargate**.
4. The **transcoder**, running as a Docker container from **ECR**, downloads the input video, transcodes it (e.g., via FFmpeg), and uploads the output to the **output S3 bucket**.
5. User sees a **download link on the frontend**, once the transcoded file is available in the output bucket.

---

## 🛠 Technologies Used

| Layer          | Tech Stack                                 |
|----------------|--------------------------------------------|
| Frontend        | React + Vite                              |
| Backend         | Node.js + Express                         |
| Cloud Services  | AWS S3, AWS SQS, AWS ECS/Fargate, ECR     |
| Processing      | FFmpeg (Transcoding in Docker Container)  |
| Queue           | AWS SQS                                   |
| Deployment      | Docker, any PaaS (Railway, Render, Koyeb) |

---

## 📁 Folder Guide

### `/frontend`
- Built using **Vite + React**
- Uploads file to S3 using **pre-signed URL**
- Displays download link when transcoding is complete

### `/backend`
- Provides APIs such as:
  - `GET /sign-url`: Generate S3 pre-signed URL
  - `GET /status`: (Optional) Check when output file is ready

### `/consumer`
- Node.js script to:
  - Poll and consume SQS messages
  - Orchestrate ECS tasks via `@aws-sdk/client-ecs` and Fargate
  - Delete message after ECS task is triggered

### `/transcoder`
- Dockerized app with `FFmpeg`
- Script that:
  - Downloads the input file from S3
  - Transcodes video
  - Uploads the output to an output S3 bucket

---

## ⚙️ Environment Variables

Create a `.env` in each service (especially `consumer`, `backend`, and `transcoder`) with:

AWS Credentials  
AWS_ACCESS_KEY_ID=  
AWS_SECRET_ACCESS_KEY=  
AWS_REGION=

S3 Buckets  
INPUT_BUCKET_NAME=  
OUTPUT_BUCKET_NAME=

ECS / Fargate  
ECS_CLUSTER_ARN=  
ECS_TASK_DEFINITION=  
ECS_CONTAINER_NAME=  
ECS_SECURITY_GROUP=  
ECS_SUBNETS=subnet-xxx,subnet-yyy

SQS Queue  
SQS_QUEUE_URL=

---

## 🐋 Docker: Transcoder Container

### Dockerfile (`/transcoder/Dockerfile`)

```dockerfile
FROM node:18

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY . .

RUN npm install

CMD ["node", "index.js"]
```

### Push image to ECR

```bash
# Authenticate Docker with ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin <account>.dkr.ecr.amazonaws.com

# Tag and push
docker build -t video-transcoder .
docker tag video-transcoder:latest <account>.dkr.ecr.amazonaws.com/video-transcoder:latest
docker push <account>.dkr.ecr.amazonaws.com/video-transcoder:latest
```

---

## ☁️ Deploying the Consumer

### Option A: Docker + Cloud (e.g., Railway, Northflank, Render)
```bash
docker build -t video-consumer ./consumer
```

### Option B: Serverless Worker
- Deploy using Node.js background/worker type in Render, Railway, or similar.
- No need to expose any ports.

---

## 🧪 Usage Flow

1. User opens React app.
2. Uploads video → Pre-signed URL → S3 (input bucket)
3. S3 triggers → SQS message
4. Consumer → Launch ECS/Fargate → Runs transcoder
5. Transcoder downloads from S3 → Converts → Uploads to Output bucket
6. Frontend polls or gets notified → Displays link to download

---

## ✅ TODOs

- [x] Upload video with signed URL
- [x] Trigger queue on S3 upload
- [x] Poll and consume SQS messages
- [x] Invoke ECS/Fargate transcoder job
- [x] Transcode the video using FFmpeg
- [x] Upload result to output bucket
- [x] Display download link on frontend

---

## 📄 License
MIT

---

## 💬 Support

Open an issue or reach out via the Discussions tab.