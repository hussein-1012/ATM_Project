using System.Net;
using System.Net.Http.Json;
using AqrabMakinaLeek.Application.Common.Models;
using Xunit;

namespace AqrabMakinaLeek.IntegrationTests;

public class NavigationEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public NavigationEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetRoute_Returns200_WithRouteStepsAndDuration()
    {
        var atmId = "60c72b2f9b1d8b001c8e4d1a";
        var url = $"/v1/navigation/route/{atmId}?fromLat=29.3000&fromLng=30.8400&mode=Walk";
        var response = await _client.GetAsync(url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var route = await response.Content.ReadFromJsonAsync<RouteResult>();
        Assert.NotNull(route);
        Assert.True(route.DistanceMeters > 0);
        Assert.True(route.DurationSeconds > 0);
        Assert.NotEmpty(route.Steps);
    }
}
