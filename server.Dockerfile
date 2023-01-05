# Image
FROM node:lts-bullseye
# Timezone shenanigans
ENV TZ=Europe/Berlin
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y tzdata
# Folders & Permissions
RUN mkdir /server
RUN mkdir /uploads
RUN chmod -R 777 /uploads
WORKDIR /server
# Prepare & Build Server
COPY . /server/
RUN npm ci --include=dev
# Run
EXPOSE 8080
CMD ["npm", "run", "dev"]
