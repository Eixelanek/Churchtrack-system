# Use PHP with Apache
FROM php:8.1-apache

# Install MySQL extension
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Enable Apache mod_rewrite
RUN a2enmod rewrite headers

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
