FROM bitnami/spark:3.0.0
LABEL maintainer="Manuel Klein, Erik Schmitt"
WORKDIR /app

#------------------------------------
# Set execution environment

# Java Dependencies for Spark Kafka
# These are obtained using Ivy later
ENV SPARK_VERSION "3.0.0"
ENV SPARK_KAFKA_DEPENDENCY "org.apache.spark:spark-sql-kafka-0-10_2.12:${SPARK_VERSION}"
ENV IVY_PACKAGE_DIR "/tmp/.ivy"

#------------------------------------
# Prepare the system

USER root

# Workaround for "failure to login" error message: 
# cf. https://stackoverflow.com/questions/41864985/hadoop-ioexception-failure-to-login/56083736
RUN groupadd --gid 1001 spark
RUN useradd --uid 1001 --gid spark --shell /bin/bash spark
# End: Workaround

RUN apt-get update && apt-get install -y zip
RUN chown spark:spark /app/

USER spark

WORKDIR /app

#------------------------------------
# Prepare dependencies in ZIP file

# Pre-Install Maven dependencies by running an empty python file using spark-submit
# to benefit from Docker's build cache
RUN touch /tmp/empty.py && spark-submit --verbose \
	--conf "spark.jars.ivy=${IVY_PACKAGE_DIR}" \
	--packages "${SPARK_KAFKA_DEPENDENCY}" \
	/tmp/empty.py && rm -f /tmp/empty.py


# Prepare the app's python dependencies
ADD --chown=spark:spark kafka_requirements.txt /app/
RUN pip install --no-cache-dir -t /app/kafka_dependencies -r kafka_requirements.txt

# Zip all dependencies
WORKDIR /app/kafka_dependencies
RUN zip -r /app/kafka_dependencies.zip .

WORKDIR /app
RUN rm -rf /app/kafka_dependencies

#------------------------------------
# Copy the application code into the container

# Copy application code
COPY --chown=spark:spark *.py /app/

# Copy csv_files 
COPY *.csv /app/

#------------------------------------
# Set entrypoint and use dependencies zip file

# Use YARN deployment in client mode (requires Hadoop config)
# --master yarn --deploy-mode client"

# Use YARN deployment in cluster mode (requires Hadoop config)
# --master yarn --deploy-mode cluster

# Use local deployment
# --master local

ENTRYPOINT spark-submit --verbose \
	--master local \
	--conf "spark.jars.ivy=${IVY_PACKAGE_DIR}" \
	--packages "${SPARK_KAFKA_DEPENDENCY}" \
	--py-files /app/kafka_dependencies.zip \
	/app/csv2producer.py

CMD [""]
