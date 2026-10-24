# Multi-stage Dockerfile for AqrabMakinaLeek .NET 10 WebAPI
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy solution and project files for layer caching
COPY Directory.Build.props ./
COPY src/AqrabMakinaLeek.Domain/*.csproj ./src/AqrabMakinaLeek.Domain/
COPY src/AqrabMakinaLeek.Application/*.csproj ./src/AqrabMakinaLeek.Application/
COPY src/AqrabMakinaLeek.Infrastructure/*.csproj ./src/AqrabMakinaLeek.Infrastructure/
COPY src/AqrabMakinaLeek.WebApi/*.csproj ./src/AqrabMakinaLeek.WebApi/
COPY src/AqrabMakinaLeek.Importer/*.csproj ./src/AqrabMakinaLeek.Importer/
COPY tests/AqrabMakinaLeek.UnitTests/*.csproj ./tests/AqrabMakinaLeek.UnitTests/
COPY tests/AqrabMakinaLeek.IntegrationTests/*.csproj ./tests/AqrabMakinaLeek.IntegrationTests/

# Restore dependencies
RUN dotnet restore src/AqrabMakinaLeek.WebApi/AqrabMakinaLeek.WebApi.csproj

# Copy the entire source code
COPY . .

# Build and publish WebAPI
WORKDIR /src/src/AqrabMakinaLeek.WebApi
RUN dotnet publish -c Release -o /app/publish --no-restore

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app

# Non-root user for enterprise container security
USER $APP_UID

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000

ENTRYPOINT ["dotnet", "AqrabMakinaLeek.WebApi.dll"]
