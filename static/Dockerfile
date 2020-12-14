FROM nginx:latest
LABEL maintainer="Erik Schmitt"

# Install dependencies
RUN apt-get update && apt-get install -y curl
RUN curl https://cdn.amcharts.com/lib/4/core.js > /usr/share/nginx/html/core.js && \
    curl https://cdn.amcharts.com/lib/4/charts.js > /usr/share/nginx/html/charts.js && \
    curl https://cdn.amcharts.com/lib/4/themes/animated.js > /usr/share/nginx/html/animated.js && \
    curl https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css > /usr/share/nginx/html/materialize.min.css && \
    curl https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js > /usr/share/nginx/html/materialize.min.js && \
    curl https://code.jquery.com/jquery-3.5.1.min.js > /usr/share/nginx/html/jquery.min.js

# Install app
COPY ./css/* /usr/share/nginx/html/
COPY ./js/* /usr/share/nginx/html/
COPY ./fonts/* /usr/share/nginx/html/