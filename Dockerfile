# Use PHP with Apache
FROM php:8.1-apache

# Install system dependencies and Composer
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    && docker-php-ext-install zip \
    && curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

# Install MySQL extension
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Enable Apache modules
RUN a2enmod rewrite headers

# Copy Apache CORS configuration
COPY apache-cors.conf /etc/apache2/sites-available/000-default.conf

# Copy composer files first
COPY composer.json composer.lock /var/www/html/

# Install PHP dependencies
WORKDIR /var/www/html
RUN composer install --no-dev --optimize-autoloader

# Copy application files
COPY api/ /var/www/html/api/
COPY uploads/ /var/www/html/uploads/

# Set permissions
RUN chown -R www-data:www-data /var/www/html
RUN chmod -R 755 /var/www/html

# Expose port 80
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
