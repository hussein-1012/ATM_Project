using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Enums;
using Xunit;

namespace AqrabMakinaLeek.IntegrationTests;

public class ReportsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ReportsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task PostReport_Succeeds_And_SubsequentReportWithinWindow_Returns429Cooldown()
    {
        // 1. Register a reporting user to get token
        var email = $"reporter_{Guid.NewGuid():N}@example.com";
        var regResponse = await _client.PostAsJsonAsync("/v1/auth/register", new RegisterRequest("Reporter", email, "Password123!"));
        var authRes = await regResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(authRes);

        var token = authRes.AccessToken;
        var atmId = "60c72b2f9b1d8b001c8e4d1a";
        var reportReq = new CreateReportRequest(AtmReportStatus.OUT_OF_CASH);

        // 2. First report -> 201 Created
        using var firstHttp = new HttpRequestMessage(HttpMethod.Post, $"/v1/atms/{atmId}/reports");
        firstHttp.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        firstHttp.Content = JsonContent.Create(reportReq);
        var firstResponse = await _client.SendAsync(firstHttp);

        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        var reportDto = await firstResponse.Content.ReadFromJsonAsync<AtmReportResponseDto>();
        Assert.NotNull(reportDto);
        Assert.Equal(AtmReportStatus.OUT_OF_CASH, reportDto.Status);

        // 3. Immediate second report -> 429 Cooldown
        using var secondHttp = new HttpRequestMessage(HttpMethod.Post, $"/v1/atms/{atmId}/reports");
        secondHttp.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        secondHttp.Content = JsonContent.Create(reportReq);
        var secondResponse = await _client.SendAsync(secondHttp);

        Assert.Equal((HttpStatusCode)429, secondResponse.StatusCode);

        var errContent = await secondResponse.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(errContent);
        Assert.Equal("REPORT_COOLDOWN", doc.RootElement.GetProperty("code").GetString());
    }

    [Fact]
    public async Task GetReports_Returns200_WithList()
    {
        var atmId = "60c72b2f9b1d8b001c8e4d1a";
        var response = await _client.GetAsync($"/v1/atms/{atmId}/reports");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var reports = await response.Content.ReadFromJsonAsync<List<AtmReportResponseDto>>();
        Assert.NotNull(reports);
    }
}
