# Use PHP with Apache
FROM php:8.1-apache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libzip-dev \
    && docker-php-ext-install zip

# Install MySQL extension
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Enable Apache modules
RUN a2enmod rewrite headers

# Copy Apache CORS configuration
COPY apache-cors.conf /etc/apache2/sites-available/000-default.conf

# Copy application files
COPY api/ /var/www/html/api/
COPY uploads/ /var/www/html/uploads/
COPY vendor/ /var/www/html/vendor/

# Set permissions
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
