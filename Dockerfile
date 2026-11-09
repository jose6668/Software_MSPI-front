FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202
WORKDIR /opt/mspi
COPY server/ server/
COPY public/ public/
USER 1000:1000
CMD ["node","server/main.mjs"]
