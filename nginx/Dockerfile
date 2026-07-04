FROM nginx:alpine

# Remove default configuration file
RUN rm /etc/nginx/nginx.conf

# Copy custom configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy custom 502 error page
COPY 502.html /usr/share/nginx/html/502.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
