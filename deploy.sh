#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="birthday-calendar-exporter"
IMAGE_TAG="latest"
TAR_FILE="/tmp/${IMAGE_NAME}.tar"

# ── Destination ────────────────────────────────────────────────────────────────
read -rp "Remote user:  " REMOTE_USER
read -rp "Remote host:  " REMOTE_HOST
read -rp "SSH port [22]: " REMOTE_PORT
REMOTE_PORT="${REMOTE_PORT:-22}"

SSH_OPTS=(-p "$REMOTE_PORT" -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "$REMOTE_PORT" -o StrictHostKeyChecking=accept-new)

# ── Detect remote platform ─────────────────────────────────────────────────────
echo
echo "▶ Detecting remote platform …"
REMOTE_ARCH=$(ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "uname -m")
case "$REMOTE_ARCH" in
  x86_64)           PLATFORM="linux/amd64" ;;
  aarch64|arm64)    PLATFORM="linux/arm64" ;;
  armv7l)           PLATFORM="linux/arm/v7" ;;
  *)                echo "Unknown architecture: $REMOTE_ARCH"; exit 1 ;;
esac
echo "  Remote arch: ${REMOTE_ARCH} → building for ${PLATFORM}"

# ── Build ──────────────────────────────────────────────────────────────────────
echo "▶ Building image ${IMAGE_NAME}:${IMAGE_TAG} …"
docker build --platform "$PLATFORM" -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# ── Pack ───────────────────────────────────────────────────────────────────────
echo "▶ Saving image to ${TAR_FILE} …"
docker save "${IMAGE_NAME}:${IMAGE_TAG}" -o "$TAR_FILE"

# ── Transfer ───────────────────────────────────────────────────────────────────
echo "▶ Transferring to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT} …"
scp "${SCP_OPTS[@]}" "$TAR_FILE" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"

# ── Load & tag on remote ───────────────────────────────────────────────────────
echo "▶ Loading image on remote host …"
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" bash << EOF
  set -euo pipefail
  sudo docker load -i /tmp/${IMAGE_NAME}.tar
  sudo docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:${IMAGE_TAG}
  rm /tmp/${IMAGE_NAME}.tar
  echo "Image loaded:"
  sudo docker images ${IMAGE_NAME}
EOF

# ── Cleanup local tar ──────────────────────────────────────────────────────────
rm "$TAR_FILE"

echo
echo "✓ Done — ${IMAGE_NAME}:${IMAGE_TAG} is ready on ${REMOTE_HOST}"
